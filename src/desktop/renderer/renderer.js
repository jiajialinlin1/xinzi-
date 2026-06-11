let hideTimer = null;

document.body.addEventListener('mouseenter', () => {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
});

document.body.addEventListener('mouseleave', () => {
  hideTimer = setTimeout(() => window.xinziAPI.hide(), 50);
});
