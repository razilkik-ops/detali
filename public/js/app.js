(() => {
  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  const dialog = document.querySelector('[data-request-dialog]');

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

  document.querySelectorAll('[data-open-request]').forEach((button) => button.addEventListener('click', () => {
    if (dialog?.showModal) dialog.showModal();
  }));
  document.querySelector('[data-close-request]')?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (outside) dialog.close();
  });

  const submitForm = async (form) => {
    const status = form.querySelector('.form-status');
    const button = form.querySelector('button[type="submit"]');
    status.className = 'form-status visible';
    status.textContent = 'Отправляем…';
    button.disabled = true;
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
      });
      const result = await response.json();
      status.textContent = result.message;
      status.classList.add(result.ok ? 'success' : 'error');
      if (result.ok) form.reset();
    } catch {
      status.textContent = 'Не удалось отправить форму. Позвоните нам или напишите на e-mail.';
      status.classList.add('error');
    } finally {
      button.disabled = false;
    }
  };
  document.querySelectorAll('[data-request-form]').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (form.reportValidity()) submitForm(form);
  }));

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
