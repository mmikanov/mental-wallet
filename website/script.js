/**
 * Mental Wallet Landing Page
 * Progressive enhancement: FAQ uses native <details> elements.
 * This script only adds smooth open/close animation if JS is available.
 */

(function () {
  'use strict';

  // Animate details open/close for smoother UX
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(function (details) {
    const answer = details.querySelector('.faq-answer');
    if (!answer) return;

    details.addEventListener('toggle', function () {
      if (details.open) {
        answer.style.maxHeight = answer.scrollHeight + 'px';
        answer.style.opacity = '1';
      }
    });
  });
})();
