// The app never runs inside another site's frame (protects against clickjacking).
// GitHub Pages cannot send the frame-ancestors header, so this does the same job.
if (window.top !== window.self) {
  try {
    window.top.location = window.self.location.href;
  } catch (e) {
    document.documentElement.style.display = 'none';
  }
}
