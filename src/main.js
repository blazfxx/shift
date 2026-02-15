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
    
    this.init();
  }

  init() {
    this.cacheElements();
    this.bindEvents();
    this.checkSharedArrayBuffer();
    this.loadFFmpeg();
  }

  cacheElements() {
    this.dropZone = document.getElementById('dropZone');
    this.fileInput = document.getElementById('fileInput');
    this.fileItems = document.getElementById('fileItems');
    this.fileCount = document.getElementById('fileCount');
    this.convertBtn = document.getElementById('convertBtn');
    this.progressContainer = document.getElementById('progressContainer');
    this.progressBar = document.getElementById('progressBar');
    this.progressText = document.getElementById('progressText');
    this.statusMessage = document.getElementById('statusMessage');
    this.clearBtn = document.getElementById('clearBtn');
    this.downloadSection = document.getElementById('downloadSection');
    this.downloadItems = document.getElementById('downloadItems');
  }

  checkSharedArrayBuffer() {
    if (typeof SharedArrayBuffer === 'undefined') {
      this.showError('SharedArrayBuffer is not available. Please ensure COOP/COEP headers are set correctly.');
      return false;
    }
    return true;
  }

  async loadFFmpeg() {
    try {
      this.updateStatus('Loading FFmpeg...');
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

      const coreURL = await toBlobURL(
        'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
        'text/javascript'
      );
      const wasmURL = await toBlobURL(
        'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
        'application/wasm'
      );

      await this.ffmpeg.load({
        coreURL,
        wasmURL
      });

      this.isLoaded = true;
      this.updateStatus('FFmpeg loaded successfully');
      this.updateConvertButton();
      
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      this.showError(`Failed to load FFmpeg: ${error.message}`);
    }
  }

  bindEvents() {
    this.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
    this.dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
    this.dropZone.addEventListener('drop', this.handleDrop.bind(this));
    this.dropZone.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    this.convertBtn.addEventListener('click', this.handleConvert.bind(this));
    this.clearBtn.addEventListener('click', this.clearAll.bind(this));
  }

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.add('dragover');
  }

  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.remove('dragover');
  }

  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.remove('dragover');
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    this.processFiles(droppedFiles);
  }

  handleFileSelect(e) {
    const selectedFiles = Array.from(e.target.files);
    this.processFiles(selectedFiles);
    e.target.value = '';
  }

  processFiles(newFiles) {
    const totalFiles = this.files.length + newFiles.length;
    
    if (totalFiles > MAX_FILES) {
      this.showError(`Maximum ${MAX_FILES} files allowed. You have ${this.files.length} files and tried to add ${newFiles.length} more.`);
      return;
    }

    newFiles.forEach(file => {
      const fileInfo = this.createFileInfo(file);
      if (fileInfo) {
        this.files.push(fileInfo);
      }
    });

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

  renderFileList() {
    this.fileCount.textContent = `${this.files.length} file${this.files.length !== 1 ? 's' : ''}`;
    
    if (this.files.length === 0) {
      this.fileItems.innerHTML = '<div class="empty-state"><p>No files selected</p></div>';
      return;
    }

    this.fileItems.innerHTML = this.files.map((fileInfo, index) => this.createFileListItem(fileInfo, index)).join('');
    
    this.fileItems.querySelectorAll('.format-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.files[index].targetFormat = e.target.value;
      });
    });

    this.fileItems.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.removeFile(index);
      });
    });

    this.fileItems.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.downloadFile(this.files[index]);
      });
    });
  }

  createFileListItem(fileInfo, index) {
    const outputFormats = this.getOutputFormats(fileInfo.fileType, fileInfo.extension);
    const isUnsupported = fileInfo.fileType === 'unknown' || outputFormats.length === 0;
    
    const statusIcon = this.getStatusIcon(fileInfo.status);
    const progressHTML = fileInfo.status === 'converting' 
      ? `<div class="file-progress"><div class="file-progress-bar" style="width: ${fileInfo.progress}%"></div></div>` 
      : '';

    return `
      <div class="file-item ${fileInfo.status}" data-id="${fileInfo.id}">
        <div class="file-info">
          <span class="file-icon">${this.getFileIcon(fileInfo.fileType)}</span>
          <span class="file-name" title="${fileInfo.name}">${this.truncateFileName(fileInfo.name)}</span>
          <span class="file-size">${this.formatFileSize(fileInfo.file.size)}</span>
        </div>
        ${progressHTML}
        <div class="file-actions">
          ${!isUnsupported ? `
            <select class="format-select" data-index="${index}" ${fileInfo.status === 'converting' ? 'disabled' : ''}>
              ${outputFormats.map(format => `
                <option value="${format}" ${format === fileInfo.targetFormat ? 'selected' : ''}>
                  ${format.toUpperCase()}
                </option>
              `).join('')}
            </select>
          ` : `<span class="unsupported">Unsupported format</span>`}
          <button class="remove-btn" data-index="${index}" ${fileInfo.status === 'converting' ? 'disabled' : ''}>×</button>
          ${fileInfo.convertedBlob ? `
            <button class="download-btn" data-index="${index}">↓</button>
          ` : ''}
          <span class="status-icon">${statusIcon}</span>
        </div>
      </div>
    `;
  }

  getStatusIcon(status) {
    switch (status) {
      case 'pending': return '⏳';
      case 'converting': return '🔄';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '';
    }
  }

  getFileIcon(fileType) {
    const icons = {
      image: '🖼️',
      video: '🎬',
      audio: '🎵',
      document: '📄',
      unknown: '❓'
    };
    return icons[fileType] || icons.unknown;
  }

  truncateFileName(name, maxLength = 30) {
    if (name.length <= maxLength) return name;
    const ext = this.getFileExtension(name);
    const baseName = name.slice(0, name.lastIndexOf('.'));
    const truncated = baseName.slice(0, maxLength - ext.length - 4) + '...';
    return `${truncated}.${ext}`;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  removeFile(index) {
    this.files.splice(index, 1);
    this.renderFileList();
    this.updateConvertButton();
  }

  clearAll() {
    this.files = [];
    this.convertedFiles = [];
    this.renderFileList();
    this.updateConvertButton();
    this.downloadSection.style.display = 'none';
    this.progressContainer.style.display = 'none';
    this.hideError();
  }

  updateConvertButton() {
    const hasValidFiles = this.files.some(f => 
      f.fileType !== 'unknown' && 
      FILE_FORMATS[f.fileType]?.outputs.length > 0
    );
    
    this.convertBtn.disabled = !this.isLoaded || !hasValidFiles || this.isConverting;
    this.convertBtn.textContent = this.isConverting ? 'Converting...' : 'Convert';
  }

  async handleConvert() {
    if (!this.isLoaded || this.isConverting) return;

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
    this.showProgress();

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
        }

        this.renderFileList();
      }

      this.updateOverallProgress(validFiles.length, validFiles.length);
      this.updateStatus(`Converted ${this.convertedFiles.length} of ${validFiles.length} files`);
      
      if (this.convertedFiles.length > 0) {
        this.renderDownloadSection();
      }

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
      const progressBar = this.fileItems.querySelectorAll('.file-progress-bar')[index];
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
    }
  }

  updateOverallProgress(current, total) {
    const percent = Math.round((current / total) * 100);
    this.progressBar.style.width = `${percent}%`;
    this.progressText.textContent = `${current}/${total} files`;
  }

  showProgress() {
    this.progressContainer.style.display = 'block';
    this.progressBar.style.width = '0%';
    this.progressText.textContent = '0/0 files';
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

  renderDownloadSection() {
    this.downloadSection.style.display = 'block';
    this.downloadItems.innerHTML = this.convertedFiles.map(fileInfo => {
      const baseName = fileInfo.name.slice(0, fileInfo.name.lastIndexOf('.'));
      return `
        <div class="download-item">
          <span class="download-name">${baseName}.${fileInfo.targetFormat}</span>
          <button class="btn btn-primary download-single-btn" data-id="${fileInfo.id}">Download</button>
        </div>
      `;
    }).join('');

    this.downloadItems.querySelectorAll('.download-single-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseFloat(e.target.dataset.id);
        const fileInfo = this.convertedFiles.find(f => f.id === id);
        if (fileInfo) {
          this.downloadFile(fileInfo);
        }
      });
    });
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

document.addEventListener('DOMContentLoaded', () => {
  new FileConverter();
});