/* ══════════════════════════════════════════════════════════════════
   MarkBridge – Landing Page Scripts
   ══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Navigation: Scroll effect ──────────────────────────────────
  const nav = document.getElementById('nav');

  function handleNavScroll() {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll();

  // ─── Navigation: Mobile toggle ──────────────────────────────────
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');

  navToggle.addEventListener('click', function () {
    navToggle.classList.toggle('active');
    navLinks.classList.toggle('open');
  });

  // Close mobile nav when a link is clicked
  navLinks.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      navToggle.classList.remove('active');
      navLinks.classList.remove('open');
    });
  });

  // ─── Smooth scroll for anchor links ─────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const navHeight = nav.offsetHeight;
        const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // ─── Scroll animations (Intersection Observer) ──────────────────
  const animatedElements = document.querySelectorAll(
    '.feature-card, .step, .contact-info, .contact-form-wrapper, .platforms-inner'
  );

  animatedElements.forEach(function (el) {
    el.classList.add('fade-in');
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    animatedElements.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    // Fallback: show all immediately
    animatedElements.forEach(function (el) {
      el.classList.add('visible');
    });
  }

  // ─── Contact form handling ──────────────────────────────────────
  const form = document.getElementById('contact-form');
  const formSuccess = document.getElementById('form-success');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Basic validation
    const name = document.getElementById('name');
    const email = document.getElementById('email');
    const message = document.getElementById('message');
    let valid = true;

    [name, email, message].forEach(function (field) {
      field.style.borderColor = '';
    });

    if (!name.value.trim()) {
      name.style.borderColor = '#FF5630';
      valid = false;
    }

    if (!email.value.trim() || !isValidEmail(email.value)) {
      email.style.borderColor = '#FF5630';
      valid = false;
    }

    if (!message.value.trim()) {
      message.style.borderColor = '#FF5630';
      valid = false;
    }

    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Sending...';

    var formData = new FormData(form);

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(formData).toString()
    })
      .then(function (response) {
        if (response.ok) {
          form.style.display = 'none';
          formSuccess.classList.remove('hidden');
        } else {
          throw new Error('Form submission failed');
        }
      })
      .catch(function () {
        alert('Something went wrong. Please email us at hello@markbridge.io instead.');
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      });
  });

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ─── Staggered animation for feature cards ─────────────────────
  const featureCards = document.querySelectorAll('.feature-card');
  featureCards.forEach(function (card, index) {
    card.style.transitionDelay = (index * 0.08) + 's';
  });

  // ─── Staggered animation for steps ─────────────────────────────
  const steps = document.querySelectorAll('.step');
  steps.forEach(function (step, index) {
    step.style.transitionDelay = (index * 0.15) + 's';
  });
})();
