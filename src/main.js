const { FFmpeg } = FFmpegWASM;
const { fetchFile, toBlobURL } = FFmpegUtil;

const FILE_FORMATS = {
  image: {
    extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico', 'svg', 'tiff', 'tif'],
    outputs: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico']
  },
  video: {
    extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'm4v', '3gp'],
    outputs: ['mp4', 'webm', 'avi', 'mov', 'mkv']
  },
  audio: {
    extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus'],
    outputs: ['mp3', 'wav', 'ogg', 'flac', 'aac']
  },
  document: {
    extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
    outputs: []
  }
};

const MAX_FILES = 10;

class FileConverter {
  constructor() {
    this.ffmpeg = null;
    this.isLoaded = false;
    this.files = [];
    this.convertedFiles = [];
    this.isConverting = false;
    this.filePreviews = new Map(); // Store preview URLs
    
    this.init();
  }

  init() {
    this.cacheElements();
    this.bindEvents();
    this.checkSharedArrayBuffer();
    this.loadFFmpeg();
  }

  cacheElements() {
    // Views
    this.uploadView = document.getElementById('uploadView');
    this.fileView = document.getElementById('fileView');
    this.hero = document.querySelector('.hero');
    
    // Upload elements
    this.dropZone = document.getElementById('dropZone');
    this.fileInput = document.getElementById('fileInput');
    this.addFilesInput = document.getElementById('addFilesInput');
    
    // File list elements
    this.fileItems = document.getElementById('fileItems');
    this.fileCount = document.getElementById('fileCount');
    this.convertBtn = document.getElementById('convertBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.addFilesBtn = document.getElementById('addFilesBtn');
    
    // Progress elements
    this.progressContainer = document.getElementById('progressContainer');
    this.progressBar = document.getElementById('progressBar');
    this.progressPercent = document.getElementById('progressPercent');
    this.progressText = document.getElementById('progressText');
    
    // Status and download
    this.statusMessage = document.getElementById('statusMessage');
    this.downloadSection = document.getElementById('downloadSection');
    this.downloadItems = document.getElementById('downloadItems');
    
    // Navbar
    this.navbarBrand = document.querySelector('.navbar-brand');
  }

  checkSharedArrayBuffer() {
    if (typeof SharedArrayBuffer === 'undefined') {
      console.warn('SharedArrayBuffer is not available. FFmpeg may not work properly.');
      return false;
    }
    return true;
  }

  async loadFFmpeg() {
    try {
      this.updateStatus('Loading converter...');
      this.ffmpeg = new FFmpeg();
      
      this.ffmpeg.on('progress', ({ progress, time }) => {
        if (this.currentFileIndex !== undefined) {
          const percent = Math.round(progress * 100);
          this.updateFileProgress(this.currentFileIndex, percent);
        }
      });

      this.ffmpeg.on('log', ({ message }) => {
        console.log('FFmpeg:', message);
      });

      // Try to load FFmpeg with a timeout - now fully self-hosted on Vercel
      const loadPromise = (async () => {
        const coreURL = 'ffmpeg/ffmpeg-core.js';
        const wasmURL = 'ffmpeg/ffmpeg-core.wasm';

        await this.ffmpeg.load({
          coreURL,
          wasmURL
        });
      })();

      // Timeout after 30 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('FFmpeg loading timeout')), 30000);
      });

      await Promise.race([loadPromise, timeoutPromise]);

      this.isLoaded = true;
      this.hideError();
      this.updateConvertButton();
      console.log('FFmpeg loaded successfully');
      
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      this.isLoaded = true; // Still allow users to try converting
      this.updateConvertButton();
      this.showError('Converter loaded with limited functionality. Some features may not work.');
    }
  }

  bindEvents() {
    // Drop zone events - only trigger file input on click, not the other way around
    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone.classList.add('drag-active');
    });
    
    this.dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone.classList.remove('drag-active');
    });
    
    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone.classList.remove('drag-active');
      const droppedFiles = Array.from(e.dataTransfer.files);
      this.processFiles(droppedFiles);
    });
    
    // Click on drop zone only triggers file input - NOT double triggering
    this.dropZone.addEventListener('click', (e) => {
      // Only trigger if we didn't click on a child element that's the file input
      if (e.target !== this.fileInput) {
        this.fileInput.click();
      }
    });
    
    this.fileInput.addEventListener('change', (e) => {
      const selectedFiles = Array.from(e.target.files);
      if (selectedFiles.length > 0) {
        this.processFiles(selectedFiles);
      }
      e.target.value = ''; // Reset so same file can be selected again
    });

    // Add more files
    if (this.addFilesBtn) {
      this.addFilesBtn.addEventListener('click', () => {
        if (this.addFilesInput) {
          this.addFilesInput.click();
        }
      });
    }

    if (this.addFilesInput) {
      this.addFilesInput.addEventListener('change', (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length > 0) {
          this.processFiles(selectedFiles);
        }
        e.target.value = '';
      });
    }

    // Action buttons
    this.convertBtn.addEventListener('click', () => this.handleConvert());
    this.clearBtn.addEventListener('click', () => this.clearAll());
    
    // Navbar brand click to go home
    if (this.navbarBrand) {
      this.navbarBrand.addEventListener('click', (e) => {
        e.preventDefault();
        this.clearAll();
      });
    }

    // Paste support
    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            pastedFiles.push(file);
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        this.processFiles(pastedFiles);
      }
    });

    // Drag and drop on entire page when in file view
    document.addEventListener('dragover', (e) => {
      if (!this.fileView.classList.contains('hidden')) {
        e.preventDefault();
      }
    });

    document.addEventListener('drop', (e) => {
      if (!this.fileView.classList.contains('hidden')) {
        // Only process if not dropping on the file list itself
        if (!e.target.closest('.file-list')) {
          e.preventDefault();
          const droppedFiles = Array.from(e.dataTransfer.files);
          if (droppedFiles.length > 0) {
            this.processFiles(droppedFiles);
          }
        }
      }
    });
  }

  processFiles(newFiles) {
    const totalFiles = this.files.length + newFiles.length;
    
    if (totalFiles > MAX_FILES) {
      this.showError(`Maximum ${MAX_FILES} files allowed. You currently have ${this.files.length}.`);
      return;
    }

    newFiles.forEach(file => {
      const fileInfo = this.createFileInfo(file);
      if (fileInfo) {
        this.files.push(fileInfo);
        // Generate preview for images
        if (fileInfo.fileType === 'image') {
          this.generatePreview(fileInfo);
        }
      }
    });

    if (this.files.length > 0) {
      this.switchToFileView();
    }

    this.renderFileList();
    this.updateConvertButton();
    this.hideError();
  }

  createFileInfo(file) {
    const extension = this.getFileExtension(file.name);
    const fileType = this.detectFileType(extension);
    
    return {
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      extension,
      fileType,
      targetFormat: this.getDefaultOutputFormat(fileType, extension),
      progress: 0,
      status: 'pending',
      convertedBlob: null
    };
  }

  generatePreview(fileInfo) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.filePreviews.set(fileInfo.id, e.target.result);
      this.renderFileList();
    };
    reader.readAsDataURL(fileInfo.file);
  }

  getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
  }

  detectFileType(extension) {
    for (const [type, config] of Object.entries(FILE_FORMATS)) {
      if (config.extensions.includes(extension)) {
        return type;
      }
    }
    return 'unknown';
  }

  getDefaultOutputFormat(fileType, currentExtension) {
    const config = FILE_FORMATS[fileType];
    if (!config || config.outputs.length === 0) return null;
    
    if (config.outputs.includes(currentExtension)) {
      const otherFormats = config.outputs.filter(f => f !== currentExtension);
      return otherFormats[0] || config.outputs[0];
    }
    return config.outputs[0];
  }

  getOutputFormats(fileType, currentExtension) {
    const config = FILE_FORMATS[fileType];
    if (!config) return [];
    return config.outputs.filter(f => f !== currentExtension);
  }

  switchToFileView() {
    this.uploadView.classList.add('hidden');
    this.fileView.classList.remove('hidden');
    this.hero.classList.add('hidden');
  }

  switchToUploadView() {
    this.uploadView.classList.remove('hidden');
    this.fileView.classList.add('hidden');
    this.hero.classList.remove('hidden');
    this.downloadSection.classList.add('hidden');
    this.progressContainer.classList.add('hidden');
  }

  renderFileList() {
    this.fileCount.textContent = `${this.files.length} file${this.files.length !== 1 ? 's' : ''}`;
    
    if (this.files.length === 0) {
      this.fileItems.innerHTML = `
        <div class="empty-state">
          <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
          <p>No files selected</p>
        </div>
      `;
      return;
    }

    this.fileItems.innerHTML = this.files.map((fileInfo, index) => this.createFileListItem(fileInfo, index)).join('');
    
    // Bind format select events
    this.fileItems.querySelectorAll('.format-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.files[index].targetFormat = e.target.value;
      });
    });

    // Bind remove button events
    this.fileItems.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.removeFile(index);
      });
    });
  }

  createFileListItem(fileInfo, index) {
    const outputFormats = this.getOutputFormats(fileInfo.fileType, fileInfo.extension);
    const isUnsupported = fileInfo.fileType === 'unknown' || outputFormats.length === 0;
    
    const statusIcon = fileInfo.status === 'completed' ? '✓' : 
                       fileInfo.status === 'error' ? '✕' : 
                       fileInfo.status === 'converting' ? '⟳' : '';

    const progressHTML = fileInfo.status === 'converting' 
      ? `<div class="file-progress"><div class="file-progress-bar" style="width: ${fileInfo.progress}%"></div></div>`
      : '';

    // Get icon/preview
    let iconHTML;
    if (fileInfo.fileType === 'image' && this.filePreviews.has(fileInfo.id)) {
      iconHTML = `<img src="${this.filePreviews.get(fileInfo.id)}" alt="" class="file-preview-img">`;
    } else {
      iconHTML = this.getFileIcon(fileInfo.fileType);
    }

    return `
      <div class="file-item ${fileInfo.status}" data-id="${fileInfo.id}">
        <div class="file-item-icon">${iconHTML}</div>
        <div class="file-item-info">
          <div class="file-item-name" title="${fileInfo.name}">${this.truncateFileName(fileInfo.name)}</div>
          <div class="file-item-meta">${this.formatFileSize(fileInfo.file.size)}</div>
        </div>
        ${progressHTML}
        <div class="file-item-actions">
          ${!isUnsupported ? `
            <span class="convert-label">Convert to:</span>
            <div class="select-wrapper">
              <select class="format-select" data-index="${index}" ${fileInfo.status === 'converting' ? 'disabled' : ''}>
                ${outputFormats.map(format => `
                  <option value="${format}" ${format === fileInfo.targetFormat ? 'selected' : ''}>
                    ${format.toUpperCase()}
                  </option>
                `).join('')}
              </select>
              <svg class="select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          ` : `<span class="unsupported-badge">Unsupported</span>`}
          <button class="remove-btn" data-index="${index}" ${fileInfo.status === 'converting' ? 'disabled' : ''} title="Remove file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          ${statusIcon ? `<span class="status-icon" style="color: ${fileInfo.status === 'completed' ? 'var(--success)' : fileInfo.status === 'error' ? 'var(--error)' : 'var(--accent)'};">${statusIcon}</span>` : ''}
        </div>
      </div>
    `;
  }

  getFileIcon(fileType) {
    const icons = {
      image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
      video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
      audio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
      document: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
      unknown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`
    };
    return icons[fileType] || icons.unknown;
  }

  truncateFileName(name, maxLength = 35) {
    if (name.length <= maxLength) return name;
    const ext = this.getFileExtension(name);
    const baseName = name.slice(0, name.lastIndexOf('.'));
    const truncated = baseName.slice(0, maxLength - ext.length - 4) + '...';
    return `${truncated}.${ext}`;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  removeFile(index) {
    const fileInfo = this.files[index];
    // Clean up preview URL
    if (this.filePreviews.has(fileInfo.id)) {
      this.filePreviews.delete(fileInfo.id);
    }
    
    this.files.splice(index, 1);
    this.renderFileList();
    this.updateConvertButton();
    
    if (this.files.length === 0) {
      this.switchToUploadView();
    }
  }

  clearAll() {
    // Clean up all preview URLs
    this.filePreviews.clear();
    this.files = [];
    this.convertedFiles = [];
    this.switchToUploadView();
    this.renderFileList();
    this.updateConvertButton();
    this.hideError();
  }

  updateConvertButton() {
    const hasValidFiles = this.files.some(f => 
      f.fileType !== 'unknown' && 
      FILE_FORMATS[f.fileType]?.outputs.length > 0
    );
    
    // Enable button if we have valid files, even if FFmpeg isn't fully loaded yet
    // This allows users to see what the issue is
    this.convertBtn.disabled = !hasValidFiles || this.isConverting;
    this.convertBtn.textContent = this.isConverting ? 'Converting...' : 'Convert Files';
  }

  async handleConvert() {
    // Check if FFmpeg is ready, if not try to reload
    if (!this.isLoaded) {
      this.showError('Converter is still loading. Please wait...');
      return;
    }

    if (this.isConverting) return;

    const validFiles = this.files.filter(f => 
      f.fileType !== 'unknown' && 
      FILE_FORMATS[f.fileType]?.outputs.length > 0 &&
      f.targetFormat
    );

    if (validFiles.length === 0) {
      this.showError('No valid files to convert');
      return;
    }

    this.isConverting = true;
    this.convertedFiles = [];
    this.updateConvertButton();
    this.progressContainer.classList.remove('hidden');
    this.downloadSection.classList.add('hidden');

    try {
      for (let i = 0; i < validFiles.length; i++) {
        this.currentFileIndex = i;
        const fileInfo = validFiles[i];
        
        fileInfo.status = 'converting';
        fileInfo.progress = 0;
        this.renderFileList();
        this.updateOverallProgress(i, validFiles.length);

        try {
          const convertedBlob = await this.convertFile(fileInfo);
          fileInfo.convertedBlob = convertedBlob;
          fileInfo.status = 'completed';
          this.convertedFiles.push(fileInfo);
        } catch (error) {
          console.error(`Failed to convert ${fileInfo.name}:`, error);
          fileInfo.status = 'error';
          fileInfo.error = error.message;
          this.showError(`Failed to convert ${fileInfo.name}: ${error.message}`);
        }

        this.renderFileList();
      }

      this.updateOverallProgress(validFiles.length, validFiles.length);
      
      // Small delay to ensure UI updates before showing download section
      setTimeout(() => {
        if (this.convertedFiles.length > 0) {
          this.renderDownloadSection();
        } else {
          this.showError('No files were converted successfully. Check console for details.');
        }
      }, 100);

    } catch (error) {
      console.error('Conversion error:', error);
      this.showError(`Conversion failed: ${error.message}`);
    } finally {
      this.isConverting = false;
      this.currentFileIndex = undefined;
      this.updateConvertButton();
    }
  }

  async convertFile(fileInfo) {
    const { file, extension, targetFormat, fileType } = fileInfo;
    
    const inputName = `input.${extension}`;
    const outputName = `output.${targetFormat}`;
    
    await this.ffmpeg.writeFile(inputName, await fetchFile(file));

    const args = this.buildFFmpegArgs(fileType, inputName, outputName, extension, targetFormat);
    
    await this.ffmpeg.exec(args);

    const data = await this.ffmpeg.readFile(outputName);
    
    await this.ffmpeg.deleteFile(inputName);
    await this.ffmpeg.deleteFile(outputName);

    return new Blob([data.buffer], { type: this.getMimeType(targetFormat) });
  }

  buildFFmpegArgs(fileType, inputName, outputName, inputFormat, outputFormat) {
    const baseArgs = ['-i', inputName];
    
    switch (fileType) {
      case 'image':
        return this.buildImageArgs(baseArgs, inputFormat, outputFormat, outputName);
      case 'video':
        return this.buildVideoArgs(baseArgs, inputFormat, outputFormat, outputName);
      case 'audio':
        return this.buildAudioArgs(baseArgs, inputFormat, outputFormat, outputName);
      default:
        return [...baseArgs, outputName];
    }
  }

  buildImageArgs(baseArgs, inputFormat, outputFormat, outputName) {
    const args = [...baseArgs];
    
    if (outputFormat === 'jpg' || outputFormat === 'jpeg') {
      args.push('-q:v', '2');
    } else if (outputFormat === 'webp') {
      args.push('-q:v', '75');
    } else if (outputFormat === 'png') {
      args.push('-compression_level', '6');
    }

    if (inputFormat === 'svg') {
      args.push('-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease');
    }

    args.push(outputName);
    return args;
  }

  buildVideoArgs(baseArgs, inputFormat, outputFormat, outputName) {
    const args = [...baseArgs];
    
    if (outputFormat === 'mp4') {
      args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23');
      args.push('-c:a', 'aac', '-b:a', '128k');
      args.push('-movflags', '+faststart');
    } else if (outputFormat === 'webm') {
      args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0');
      args.push('-c:a', 'libopus', '-b:a', '128k');
    } else if (outputFormat === 'avi') {
      args.push('-c:v', 'mpeg4', '-q:v', '5');
      args.push('-c:a', 'mp3', '-b:a', '192k');
    } else if (outputFormat === 'mov') {
      args.push('-c:v', 'libx264', '-preset', 'medium');
      args.push('-c:a', 'aac', '-b:a', '128k');
    } else if (outputFormat === 'mkv') {
      args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23');
      args.push('-c:a', 'aac', '-b:a', '128k');
    }

    args.push(outputName);
    return args;
  }

  buildAudioArgs(baseArgs, inputFormat, outputFormat, outputName) {
    const args = [...baseArgs];
    
    if (outputFormat === 'mp3') {
      args.push('-c:a', 'libmp3lame', '-b:a', '192k');
    } else if (outputFormat === 'wav') {
      args.push('-c:a', 'pcm_s16le');
    } else if (outputFormat === 'ogg') {
      args.push('-c:a', 'libvorbis', '-q:a', '5');
    } else if (outputFormat === 'flac') {
      args.push('-c:a', 'flac', '-compression_level', '5');
    } else if (outputFormat === 'aac') {
      args.push('-c:a', 'aac', '-b:a', '192k');
    }

    args.push(outputName);
    return args;
  }

  getMimeType(format) {
    const mimeTypes = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      bmp: 'image/bmp',
      ico: 'image/x-icon',
      mp4: 'video/mp4',
      webm: 'video/webm',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      mkv: 'video/x-matroska',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
      aac: 'audio/aac'
    };
    return mimeTypes[format] || 'application/octet-stream';
  }

  updateFileProgress(index, progress) {
    if (this.files[index]) {
      this.files[index].progress = progress;
      const progressBars = this.fileItems.querySelectorAll('.file-progress-bar');
      if (progressBars[index]) {
        progressBars[index].style.width = `${progress}%`;
      }
    }
  }

  updateOverallProgress(current, total) {
    const percent = Math.round((current / total) * 100);
    this.progressBar.style.width = `${percent}%`;
    this.progressPercent.textContent = `${percent}%`;
    this.progressText.textContent = `${current}/${total} files`;
  }

  renderDownloadSection() {
    console.log('Rendering download section, converted files:', this.convertedFiles.length);
    
    if (this.convertedFiles.length === 0) {
      console.warn('No converted files to display');
      this.showError('Conversion completed but no files were successfully converted.');
      return;
    }
    
    this.downloadSection.classList.remove('hidden');
    this.downloadItems.innerHTML = this.convertedFiles.map(fileInfo => {
      const baseName = fileInfo.name.slice(0, fileInfo.name.lastIndexOf('.'));
      return `
        <div class="download-item">
          <span class="download-item-name">${baseName}.${fileInfo.targetFormat}</span>
          <button class="download-btn-small" data-id="${fileInfo.id}">Download</button>
        </div>
      `;
    }).join('');

    this.downloadItems.querySelectorAll('.download-btn-small').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseFloat(e.target.dataset.id);
        const fileInfo = this.convertedFiles.find(f => f.id === id);
        if (fileInfo) {
          this.downloadFile(fileInfo);
        }
      });
    });
    
    // Scroll to download section
    this.downloadSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  downloadFile(fileInfo) {
    if (!fileInfo.convertedBlob) return;

    const url = URL.createObjectURL(fileInfo.convertedBlob);
    const link = document.createElement('a');
    link.href = url;
    
    const baseName = fileInfo.name.slice(0, fileInfo.name.lastIndexOf('.'));
    link.download = `${baseName}.${fileInfo.targetFormat}`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  updateStatus(message) {
    if (this.statusMessage) {
      this.statusMessage.textContent = message;
      this.statusMessage.className = 'status-message info';
    }
  }

  showError(message) {
    if (this.statusMessage) {
      this.statusMessage.textContent = message;
      this.statusMessage.className = 'status-message error';
    }
  }

  hideError() {
    if (this.statusMessage) {
      this.statusMessage.textContent = '';
      this.statusMessage.className = 'status-message';
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new FileConverter();
});
