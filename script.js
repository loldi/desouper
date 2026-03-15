(() => {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('nav-toggle');
  const navRight = document.querySelector('.nav-right');

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });

  if (toggle) {
    toggle.addEventListener('click', () => {
      navRight.classList.toggle('open');
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      navRight.classList.remove('open');
      target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Modal
  const modal = document.getElementById('notify-modal');
  const form = document.getElementById('notify-form');
  const success = document.getElementById('modal-success');
  const closeBtn = document.getElementById('modal-close');

  document.querySelectorAll('.notify-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.add('active');
    });
  });

  function closeModal() {
    modal.classList.remove('active');
  }

  closeBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.style.display = 'none';
    success.style.display = 'block';
  });

  // Scroll animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

  const targets = document.querySelectorAll(
    '.step, .showcase-text, .showcase-visual, .cv-stat, .bottom-cta h2, .trust-card, .report-flow, .privacy-visual'
  );

  targets.forEach((el, i) => {
    el.classList.add('fade-up');
    el.style.transitionDelay = `${i * 0.06}s`;
    observer.observe(el);
  });
})();
