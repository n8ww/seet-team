// قراءة الملفات داخل المتصفح (مجاناً) قبل إرسال النص فقط للذكاء الاصطناعي
const LIBS = {
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
};
const loaded = {};
function loadScript(src) {
  if (!loaded[src]) loaded[src] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('تعذر تحميل قارئ الملفات'));
    document.head.appendChild(s);
  });
  return loaded[src];
}

// يصغّر الصورة عشان تكلفتها تقل
function shrink(canvasOrImg, w, h, max = 1400) {
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(canvasOrImg, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}

async function readPdf(buf) {
  await loadScript(LIBS.pdf);
  const lib = window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
  const doc = await lib.getDocument({ data: buf }).promise;
  let text = '';
  for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let line = '', lastY = null;
    tc.items.forEach((it) => {
      const y = Math.round(it.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) { text += line.trim() + '\n'; line = ''; }
      line += it.str + ' '; lastY = y;
    });
    text += line.trim() + '\n';
  }
  if (text.replace(/\s/g, '').length > 40) return { text, images: [] };
  // PDF مصوّر: نحوّل أول الصفحات لصور
  const images = [];
  for (let i = 1; i <= Math.min(doc.numPages, 4); i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1.5 });
    const c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    images.push(shrink(c, c.width, c.height));
  }
  return { text: '', images };
}

async function readImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    return { text: '', images: [shrink(img, img.naturalWidth, img.naturalHeight)] };
  } finally { URL.revokeObjectURL(url); }
}

export async function readFile(file) {
  const name = file.name.toLowerCase();
  if (file.type.startsWith('image/')) return readImage(file);
  const buf = await file.arrayBuffer();
  if (name.endsWith('.pdf')) return readPdf(buf);
  if (name.endsWith('.docx')) {
    await loadScript(LIBS.mammoth);
    const r = await window.mammoth.extractRawText({ arrayBuffer: buf });
    return { text: r.value, images: [] };
  }
  if (/\.(xlsx|xls|csv)$/.test(name)) {
    await loadScript(LIBS.xlsx);
    const wb = window.XLSX.read(buf, { type: 'array' });
    const text = wb.SheetNames.map((n) => `# ${n}\n` + window.XLSX.utils.sheet_to_csv(wb.Sheets[n], { FS: ' | ', blankrows: false })).join('\n\n');
    return { text, images: [] };
  }
  if (/\.(txt|md)$/.test(name) || file.type.startsWith('text/')) return { text: new TextDecoder().decode(buf), images: [] };
  throw new Error('نوع الملف غير مدعوم. استخدم PDF أو Word (docx) أو Excel أو صورة');
}
