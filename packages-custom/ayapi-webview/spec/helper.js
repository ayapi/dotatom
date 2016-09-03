'use babel';

module.exports = {
  attachToDOM (element) {
    let specContent = document.querySelector('#spec-content');
    if (!specContent) {
      specContent = document.createElement('div');
      specContent.id = 'spec-content';
      document.body.appendChild(specContent);
    }
    if (!specContent.contains(element)) {
      return specContent.appendChild(element);
    }
  },
  domReadyPromise (webviewElement) {
    return new Promise((resolve) => {
      let disposable = webviewElement.onDomReady((url) => {
        if (url === 'about:blank') return;
        disposable.dispose();
        resolve(url);
      });
    });
  }
};