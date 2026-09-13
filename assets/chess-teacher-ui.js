/* Stable chess loader: only the base trainer UI is loaded here.
   Other experimental rescue layers are intentionally not injected because
   they duplicate click handlers and can leave the page in a perpetual load state. */
document.write('<script src="assets/chess-teacher-ui-core.js?v=11"><\\/script>');
