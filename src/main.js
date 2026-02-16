const MAX_FILES = 10;

const SUPPORTED_FORMATS = {
  image: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "ico", "svg", "tiff"],
  video: ["mp4", "webm", "avi", "mov", "mkv", "wmv", "flv", "m4v", "3gp"],
  audio: ["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma", "opus"]
};

const MIME_BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  ico: "image/x-icon",
  svg: "image/svg+xml",
  tiff: "image/tiff",
  mp4: "video/mp4",
  webm: "video/webm",
  avi: "video/x-msvideo",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  m4v: "video/mp4",
  "3gp": "video/3gpp",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  m4a: "audio/mp4",
  wma: "audio/x-ms-wma",
  opus: "audio/ogg"
};

const dom = {
  appShell: document.getElementById("appShell"),
  logoButton: document.getElementById("logoButton"),
  uploadView: document.getElementById("uploadView"),
  fileView: document.getElementById("fileView"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  addFilesButton: document.getElementById("addFilesButton"),
  clearAllButton: document.getElementById("clearAllButton"),
  convertButton: document.getElementById("convertButton"),
  fileList: document.getElementById("fileList"),
  fileCount: document.getElementById("fileCount"),
  progressSection: document.getElementById("progressSection"),
  progressPercent: document.getElementById("progressPercent"),
  progressFiles: document.getElementById("progressFiles"),
  progressFill: document.getElementById("progressFill"),
  progressBarWrap: document.getElementById("progressBarWrap"),
  downloadSection: document.getElementById("downloadSection"),
  downloadList: document.getElementById("downloadList"),
  statusMessage: document.getElementById("statusMessage")
};

const state = {
  files: [],
  ffmpeg: null,
  ffmpegReady: false,
  ffmpegLoadingPromise: null,
  fetchFile: null,
  converting: false,
  conversionProgress: {
    currentIndex: 0,
    currentProgress: 0,
    total: 0
  }
};

bindEvents();
render();

function bindEvents() {
  dom.dropzone.addEventListener("click", () => dom.fileInput.click());
  dom.fileInput.addEventListener("change", (event) => {
    handleIncomingFiles(event.target.files);
    dom.fileInput.value = "";
  });
  dom.addFilesButton.addEventListener("click", () => dom.fileInput.click());
  dom.clearAllButton.addEventListener("click", resetSession);
  dom.convertButton.addEventListener("click", convertFiles);
  dom.logoButton.addEventListener("click", resetSession);

  dom.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dom.appShell.classList.add("drag-active");
  });

  dom.dropzone.addEventListener("dragleave", () => {
    dom.appShell.classList.remove("drag-active");
  });

  dom.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dom.appShell.classList.remove("drag-active");
    handleIncomingFiles(event.dataTransfer?.files);
  });

  window.addEventListener("dragover", (event) => {
    if (!state.files.length) {
      return;
    }

    event.preventDefault();
    dom.appShell.classList.add("drag-active");
  });

  window.addEventListener("dragleave", (event) => {
    if (event.clientX === 0 && event.clientY === 0) {
      dom.appShell.classList.remove("drag-active");
    }
  });

  window.addEventListener("drop", (event) => {
    if (!state.files.length) {
      return;
    }

    event.preventDefault();
    dom.appShell.classList.remove("drag-active");
    handleIncomingFiles(event.dataTransfer?.files);
  });

  window.addEventListener("paste", (event) => {
    const clipboardItems = event.clipboardData?.items;

    if (!clipboardItems || !clipboardItems.length) {
      return;
    }

    const pastedFiles = [];
    for (const item of clipboardItems) {
      const file = item.getAsFile();
      if (file) {
        pastedFiles.push(file);
      }
    }

    if (pastedFiles.length) {
      handleIncomingFiles(pastedFiles);
    }
  });
}

function handleIncomingFiles(inputFiles) {
  if (!inputFiles || !inputFiles.length) {
    return;
  }

  const incoming = Array.from(inputFiles);
  const availableSlots = MAX_FILES - state.files.length;

  if (availableSlots <= 0) {
    setStatus(`Max ${MAX_FILES} files per session.`, "error");
    return;
  }

  const accepted = [];
  const unsupportedNames = [];

  for (const file of incoming) {
    const ext = getExtension(file.name);
    const kind = getKindForExtension(ext);
    if (!kind) {
      unsupportedNames.push(file.name);
      continue;
    }

    accepted.push(createFileRecord(file, ext, kind));
  }

  if (!accepted.length) {
    if (unsupportedNames.length) {
      setStatus(`Unsupported file type: ${unsupportedNames[0]}`, "error");
    }
    return;
  }

  const added = accepted.slice(0, availableSlots);
  const droppedCount = accepted.length - added.length;

  state.files.push(...added);

  if (unsupportedNames.length && droppedCount > 0) {
    setStatus("Some files were skipped due to format limits and file count.", "error");
  } else if (unsupportedNames.length) {
    setStatus("Some files were skipped because the format is not supported.", "error");
  } else if (droppedCount > 0) {
    setStatus(`Only the first ${availableSlots} files were added (max ${MAX_FILES}).`, "error");
  } else {
    setStatus(`${added.length} file${added.length > 1 ? "s" : ""} added.`, "success");
  }

  render();
}

function createFileRecord(file, ext, kind) {
  const outputs = SUPPORTED_FORMATS[kind].filter((candidate) => candidate !== ext);
  const targetFormat = outputs[0] || SUPPORTED_FORMATS[kind][0];

  return {
    id: crypto.randomUUID(),
    file,
    name: file.name,
    ext,
    kind,
    size: file.size,
    outputs,
    targetFormat,
    status: "ready",
    output: null,
    previewURL: kind === "image" ? URL.createObjectURL(file) : null
  };
}

function render() {
  const hasFiles = state.files.length > 0;
  dom.uploadView.classList.toggle("hidden", hasFiles);
  dom.fileView.classList.toggle("hidden", !hasFiles);
  dom.fileCount.textContent = `${state.files.length} file${state.files.length === 1 ? "" : "s"}`;
  dom.convertButton.disabled = !hasFiles || state.converting;
  dom.convertButton.textContent = state.converting ? "Converting..." : "Convert Files";

  renderFileList();
  renderDownloads();
}

function renderFileList() {
  dom.fileList.innerHTML = "";

  for (const item of state.files) {
    const li = document.createElement("li");
    li.className = "file-item";

    const thumb = item.kind === "image"
      ? `<img class="file-thumb" src="${item.previewURL}" alt="${escapeHtml(item.name)} preview">`
      : `<div class="file-thumb">${item.kind.toUpperCase()}</div>`;

    li.innerHTML = `
      ${thumb}
      <div class="file-meta">
        <span class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
        <span class="file-size">${formatFileSize(item.size)}</span>
      </div>
      <label class="format-wrap">
        Convert to:
        <select data-action="format" data-id="${item.id}">
          ${item.outputs.map((output) => `<option value="${output}" ${item.targetFormat === output ? "selected" : ""}>${output.toUpperCase()}</option>`).join("")}
        </select>
      </label>
      <div class="file-controls">
        <button class="remove-button" data-action="remove" data-id="${item.id}" type="button" aria-label="Remove file">x</button>
        <span class="status-pill ${item.status === "done" ? "done" : ""}">${item.status === "done" ? "OK" : ".."}</span>
      </div>
    `;

    dom.fileList.appendChild(li);
  }

  dom.fileList.querySelectorAll("button[data-action='remove']").forEach((button) => {
    button.addEventListener("click", () => {
      removeFile(button.dataset.id);
    });
  });

  dom.fileList.querySelectorAll("select[data-action='format']").forEach((select) => {
    select.addEventListener("change", () => {
      updateTargetFormat(select.dataset.id, select.value);
    });
  });
}

function renderDownloads() {
  dom.downloadList.innerHTML = "";
  const doneItems = state.files.filter((item) => item.output);
  dom.downloadSection.classList.toggle("hidden", doneItems.length === 0);

  for (const item of doneItems) {
    const row = document.createElement("li");
    row.className = "download-item";

    const title = document.createElement("span");
    title.textContent = item.output.name;

    const button = document.createElement("a");
    button.className = "button primary";
    button.href = item.output.url;
    button.download = item.output.name;
    button.textContent = "Download";

    row.append(title, button);
    dom.downloadList.appendChild(row);
  }
}

function removeFile(id) {
  const index = state.files.findIndex((item) => item.id === id);
  if (index < 0 || state.converting) {
    return;
  }

  cleanupFileResources(state.files[index]);
  state.files.splice(index, 1);

  if (!state.files.length) {
    setStatus("Session cleared.", "success");
  }

  render();
}

function updateTargetFormat(id, format) {
  const item = state.files.find((entry) => entry.id === id);
  if (!item || state.converting) {
    return;
  }
  item.targetFormat = format;
}

async function convertFiles() {
  if (!state.files.length || state.converting) {
    return;
  }

  state.converting = true;
  resetProgress();
  dom.progressSection.classList.remove("hidden");
  dom.downloadSection.classList.add("hidden");
  setStatus("Preparing FFmpeg engine...", "");
  render();

  try {
    await ensureFFmpeg();
    state.conversionProgress.total = state.files.length;

    for (let index = 0; index < state.files.length; index += 1) {
      const fileItem = state.files[index];
      fileItem.status = "working";
      state.conversionProgress.currentIndex = index;
      state.conversionProgress.currentProgress = 0;
      updateProgress();
      renderFileList();

      await convertSingleFile(fileItem);

      fileItem.status = "done";
      state.conversionProgress.currentProgress = 1;
      updateProgress();
      renderFileList();
      dom.progressFiles.textContent = `${index + 1}/${state.files.length} files`;
    }

    setStatus("Conversion complete. Download your files below.", "success");
    renderDownloads();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Conversion failed: ${message}`, "error");
  } finally {
    state.converting = false;
    render();
  }
}

async function ensureFFmpeg() {
  if (state.ffmpegReady) {
    return;
  }

  if (!state.ffmpegLoadingPromise) {
    state.ffmpegLoadingPromise = loadFFmpegRuntime();
  }

  try {
    await state.ffmpegLoadingPromise;
    state.ffmpegReady = true;
  } catch (error) {
    state.ffmpegLoadingPromise = null;
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to initialize FFmpeg runtime. ${reason}`);
  }
}

async function loadFFmpegRuntime() {
  let FFmpeg = null;
  let fetchFileFn = null;
  let toBlobURLFn = null;

  try {
    const [ffmpegModule, utilModule] = await Promise.all([
      import("./ffmpeg/ffmpeg.js"),
      import("./ffmpeg/ffmpeg-util.js")
    ]);
    FFmpeg = ffmpegModule?.FFmpeg || null;
    fetchFileFn = utilModule?.fetchFile || null;
    toBlobURLFn = utilModule?.toBlobURL || null;
  } catch {
    // Fallback to UMD script loading below.
  }

  if (typeof FFmpeg !== "function" || typeof fetchFileFn !== "function") {
    await Promise.all([
      ensureScriptLoaded("./ffmpeg/ffmpeg.js", "ffmpeg-runtime"),
      ensureScriptLoaded("./ffmpeg/ffmpeg-util.js", "ffmpeg-utils")
    ]);

    FFmpeg = globalThis.FFmpegWASM?.FFmpeg || globalThis.FFmpeg?.FFmpeg || null;
    fetchFileFn = globalThis.FFmpegUtil?.fetchFile || null;
    toBlobURLFn = globalThis.FFmpegUtil?.toBlobURL || toBlobURLFn;
  }

  if (typeof FFmpeg !== "function" || typeof fetchFileFn !== "function") {
    throw new Error("FFmpeg runtime could not be initialized from src/ffmpeg files.");
  }

  state.fetchFile = fetchFileFn;
  state.ffmpeg = new FFmpeg();
  state.ffmpeg.on("progress", ({ progress }) => {
    state.conversionProgress.currentProgress = progress;
    updateProgress();
  });

  const coreAssetURL = new URL("/ffmpeg/ffmpeg-core.js", window.location.origin).href;
  const wasmAssetURL = new URL("/ffmpeg/ffmpeg-core.wasm", window.location.origin).href;

  let coreURL = coreAssetURL;
  let wasmURL = wasmAssetURL;

  if (typeof toBlobURLFn === "function") {
    try {
      [coreURL, wasmURL, workerURL] = await Promise.all([
        toBlobURLFn(coreAssetURL, "text/javascript"),
        toBlobURLFn(wasmAssetURL, "application/wasm")
      ]);
    } catch {
      // Fall back to direct absolute URLs.
    }
  }

  await state.ffmpeg.load({ coreURL, wasmURL });
}

function ensureScriptLoaded(src, id) {
  const existing = document.getElementById(id);
  if (existing) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load runtime script: ${src}`));
    document.head.appendChild(script);
  });
}

async function convertSingleFile(fileItem) {
  const inputName = `input-${fileItem.id}.${fileItem.ext}`;
  const outputName = `${stripExtension(fileItem.name)}.${fileItem.targetFormat}`;

  await state.ffmpeg.writeFile(inputName, await state.fetchFile(fileItem.file));
  await state.ffmpeg.exec(["-i", inputName, outputName]);
  const outputData = await state.ffmpeg.readFile(outputName);

  const mime = MIME_BY_EXT[fileItem.targetFormat] || "application/octet-stream";
  const blob = new Blob([outputData], { type: mime });
  const url = URL.createObjectURL(blob);

  if (fileItem.output?.url) {
    URL.revokeObjectURL(fileItem.output.url);
  }

  fileItem.output = { name: outputName, url };

  if (state.ffmpeg.deleteFile) {
    try {
      await state.ffmpeg.deleteFile(inputName);
      await state.ffmpeg.deleteFile(outputName);
    } catch {
      // Ignore cleanup failures.
    }
  }
}

function updateProgress() {
  const { currentIndex, currentProgress, total } = state.conversionProgress;
  if (!total) {
    return;
  }

  const overall = Math.min(100, Math.round(((currentIndex + currentProgress) / total) * 100));
  dom.progressPercent.textContent = `${overall}%`;
  dom.progressFill.style.width = `${overall}%`;
  dom.progressBarWrap.setAttribute("aria-valuenow", String(overall));
  dom.progressFiles.textContent = `${Math.min(total, currentIndex + (currentProgress >= 1 ? 1 : 0))}/${total} files`;
}

function resetProgress() {
  state.conversionProgress.currentIndex = 0;
  state.conversionProgress.currentProgress = 0;
  state.conversionProgress.total = 0;
  dom.progressPercent.textContent = "0%";
  dom.progressFill.style.width = "0%";
  dom.progressFiles.textContent = "0/0 files";
  dom.progressBarWrap.setAttribute("aria-valuenow", "0");
}

function resetSession() {
  if (state.converting) {
    return;
  }

  for (const item of state.files) {
    cleanupFileResources(item);
  }

  state.files = [];
  dom.progressSection.classList.add("hidden");
  dom.downloadSection.classList.add("hidden");
  setStatus("", "");
  resetProgress();
  render();
}

function cleanupFileResources(item) {
  if (item.previewURL) {
    URL.revokeObjectURL(item.previewURL);
  }
  if (item.output?.url) {
    URL.revokeObjectURL(item.output.url);
  }
}

function setStatus(message, type) {
  dom.statusMessage.textContent = message;
  dom.statusMessage.classList.remove("error", "success");
  if (type) {
    dom.statusMessage.classList.add(type);
  }
}

function getExtension(filename) {
  const pieces = filename.toLowerCase().split(".");
  return pieces.length > 1 ? pieces.at(-1) : "";
}

function getKindForExtension(ext) {
  if (SUPPORTED_FORMATS.image.includes(ext)) {
    return "image";
  }
  if (SUPPORTED_FORMATS.video.includes(ext)) {
    return "video";
  }
  if (SUPPORTED_FORMATS.audio.includes(ext)) {
    return "audio";
  }
  return null;
}

function formatFileSize(size) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function stripExtension(filename) {
  return filename.replace(/\.[^/.]+$/, "");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
