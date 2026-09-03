(() => {
  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');

  const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 12);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  menuButton?.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Открыть меню' : 'Закрыть меню');
    menuButton.querySelector('i')?.classList.toggle('bi-list', isOpen);
    menuButton.querySelector('i')?.classList.toggle('bi-x-lg', !isOpen);
    mobileMenu.hidden = isOpen;
    document.body.classList.toggle('menu-open', !isOpen);
  });

  mobileMenu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    mobileMenu.hidden = true;
    document.body.classList.remove('menu-open');
    menuButton?.setAttribute('aria-expanded', 'false');
  }));

  const requestDialog = document.querySelector('[data-request-dialog]');
  const requestForm = requestDialog?.querySelector('[data-request-form]');
  const requestStatus = requestDialog?.querySelector('[data-request-status]');
  const requestSubmit = requestDialog?.querySelector('[data-request-submit]');
  const requestService = requestDialog?.querySelector('[data-request-service]');
  const attachmentPicker = requestDialog?.querySelector('[data-attachment-picker]');
  const attachmentInput = requestDialog?.querySelector('[data-attachment-input]');
  const attachmentPreview = requestDialog?.querySelector('[data-attachment-preview]');
  const attachmentThumbnail = requestDialog?.querySelector('[data-attachment-thumbnail]');
  const attachmentName = requestDialog?.querySelector('[data-attachment-name]');
  const attachmentSize = requestDialog?.querySelector('[data-attachment-size]');
  const attachmentRemove = requestDialog?.querySelector('[data-attachment-remove]');
  const attachmentError = requestDialog?.querySelector('[data-attachment-error]');
  const maxAttachmentBytes = 8 * 1024 * 1024;
  const allowedAttachmentTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
  const allowedAttachmentExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf']);
  let attachmentObjectUrl = '';

  const setRequestStatus = (message = '', state = '') => {
    if (!requestStatus) return;
    requestStatus.textContent = message;
    requestStatus.dataset.state = state;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`;
  };

  const clearAttachment = () => {
    if (attachmentObjectUrl) URL.revokeObjectURL(attachmentObjectUrl);
    attachmentObjectUrl = '';
    if (attachmentInput) attachmentInput.value = '';
    if (attachmentPreview) attachmentPreview.hidden = true;
    if (attachmentThumbnail) attachmentThumbnail.innerHTML = '<i class="bi bi-file-earmark-pdf" aria-hidden="true"></i>';
    if (attachmentName) attachmentName.textContent = '';
    if (attachmentSize) attachmentSize.textContent = '';
    if (attachmentError) attachmentError.textContent = '';
  };

  const validateAttachment = (file) => {
    if (!file) return '';
    const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
    if ((file.type && !allowedAttachmentTypes.has(file.type)) || !allowedAttachmentExtensions.has(extension)) {
      return 'Можно прикрепить только JPG, PNG, WebP или PDF.';
    }
    if (file.size <= 0) return 'Выбранный файл пустой.';
    if (file.size > maxAttachmentBytes) return 'Файл больше 8 МБ. Выберите файл меньшего размера.';
    return '';
  };

  const showAttachment = (file) => {
    const error = validateAttachment(file);
    if (error) {
      clearAttachment();
      if (attachmentError) attachmentError.textContent = error;
      return false;
    }
    if (attachmentObjectUrl) URL.revokeObjectURL(attachmentObjectUrl);
    attachmentObjectUrl = '';
    if (attachmentName) attachmentName.textContent = file.name;
    if (attachmentSize) attachmentSize.textContent = formatFileSize(file.size);
    if (attachmentThumbnail) {
      attachmentThumbnail.innerHTML = '';
      if (file.type.startsWith('image/')) {
        attachmentObjectUrl = URL.createObjectURL(file);
        const image = document.createElement('img');
        image.src = attachmentObjectUrl;
        image.alt = `Предпросмотр файла ${file.name}`;
        attachmentThumbnail.append(image);
      } else {
        attachmentThumbnail.innerHTML = '<i class="bi bi-file-earmark-pdf" aria-hidden="true"></i>';
      }
    }
    if (attachmentError) attachmentError.textContent = '';
    if (attachmentPreview) attachmentPreview.hidden = false;
    return true;
  };

  attachmentInput?.addEventListener('change', () => showAttachment(attachmentInput.files?.[0]));
  attachmentRemove?.addEventListener('click', clearAttachment);

  if (attachmentPicker && attachmentInput) {
    ['dragenter', 'dragover'].forEach((eventName) => attachmentPicker.addEventListener(eventName, (event) => {
      event.preventDefault();
      attachmentPicker.classList.add('is-dragging');
    }));
    ['dragleave', 'drop'].forEach((eventName) => attachmentPicker.addEventListener(eventName, (event) => {
      event.preventDefault();
      attachmentPicker.classList.remove('is-dragging');
    }));
    attachmentPicker.addEventListener('drop', (event) => {
      const file = event.dataTransfer?.files?.[0];
      if (!file || !showAttachment(file)) return;
      try {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        attachmentInput.files = transfer.files;
      } catch {
        clearAttachment();
        if (attachmentError) attachmentError.textContent = 'Перетащить файл не удалось. Выберите его нажатием на скрепку.';
      }
    });
  }

  const openRequestDialog = (trigger) => {
    if (!requestDialog) return;
    const requestedService = trigger?.dataset.service || '';
    if (requestService && [...requestService.options].some((option) => option.value === requestedService)) {
      requestService.value = requestedService;
    }
    setRequestStatus();
    if (typeof requestDialog.showModal === 'function') requestDialog.showModal();
    else requestDialog.setAttribute('open', '');
    requestDialog.querySelector('input:not([type="hidden"])')?.focus();
  };

  document.querySelectorAll('[data-request-open]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      mobileMenu && (mobileMenu.hidden = true);
      document.body.classList.remove('menu-open');
      menuButton?.setAttribute('aria-expanded', 'false');
      openRequestDialog(trigger);
    });
  });

  requestDialog?.querySelector('[data-request-close]')?.addEventListener('click', () => requestDialog.close());
  requestDialog?.addEventListener('click', (event) => {
    if (event.target === requestDialog) requestDialog.close();
  });

  requestForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requestForm.reportValidity()) return;

    const attachment = attachmentInput?.files?.[0];
    if (attachment && !showAttachment(attachment)) return;

    requestForm.elements.source.value = window.location.href;
    const payload = new FormData(requestForm);
    setRequestStatus('Отправляем заявку…', 'pending');
    requestForm.setAttribute('aria-busy', 'true');
    if (requestSubmit) requestSubmit.disabled = true;

    try {
      const response = await fetch(requestForm.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: payload
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) {
        throw new Error(result.message || 'Не удалось отправить заявку. Попробуйте ещё раз.');
      }
      requestForm.reset();
      clearAttachment();
      setRequestStatus(result.message, 'success');
    } catch (error) {
      setRequestStatus(error instanceof Error ? error.message : 'Не удалось отправить заявку. Позвоните нам напрямую.', 'error');
    } finally {
      requestForm.removeAttribute('aria-busy');
      if (requestSubmit) requestSubmit.disabled = false;
    }
  });

  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -36px' });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('visible'));
  }
})();
