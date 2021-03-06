/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */
import { document, window } from '@ephox/dom-globals';
import { Fun, Singleton } from '@ephox/katamari';
import { Css, Element, VisualViewport } from '@ephox/sugar';
import Events from '../api/Events';
import DOMUtils from 'tinymce/core/api/dom/DOMUtils';
import Env from 'tinymce/core/api/Env';
import Delay from 'tinymce/core/api/util/Delay';
import Thor from './Thor';

const DOM = DOMUtils.DOM;

const getScrollPos = function () {
  const vp = VisualViewport.getBounds(window);

  return {
    x: vp.x(),
    y: vp.y()
  };
};

const setScrollPos = function (pos) {
  window.scrollTo(pos.x, pos.y);
};

/* tslint:disable-next-line:no-string-literal */
const visualViewport: VisualViewport.VisualViewport = window['visualViewport'];

// Experiment is for ipadOS 13 only at this stage. Chrome supports this on desktop, and ipadOS cannot be UA detected, so restrict to Safari.
const isSafari = Env.browser.isSafari();

const viewportUpdate = !isSafari || visualViewport === undefined ? { bind: Fun.noop, unbind: Fun.noop, update: Fun.noop } : (() => {
  const editorContainer = Singleton.value<Element>();

  const refreshScroll = () => {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  };

  const refreshVisualViewport = () => {
    window.requestAnimationFrame(() => {
      editorContainer.on((container) => Css.setAll(container, {
        top: visualViewport.offsetTop + 'px',
        left: visualViewport.offsetLeft + 'px',
        height: visualViewport.height + 'px',
        width: visualViewport.width + 'px'
      }));
    });
  };

  const update = Delay.throttle(() => {
    refreshScroll();
    refreshVisualViewport();
  }, 50);

  const bind = (element) => {
    editorContainer.set(element);
    update();
    visualViewport.addEventListener('resize', update);
    visualViewport.addEventListener('scroll', update);
  };

  const unbind = () => {
    editorContainer.on(() => {
      visualViewport.removeEventListener('scroll', update);
      visualViewport.removeEventListener('resize', update);
    });
    editorContainer.clear();
  };

  return {
    bind,
    unbind
  };
})();

const toggleFullscreen = function (editor, fullscreenState) {
  const body = document.body;
  const documentElement = document.documentElement;
  let editorContainerStyle;
  let editorContainer, iframe, iframeStyle;
  editorContainer = editor.getContainer();
  const editorContainerS = Element.fromDom(editorContainer);

  const fullscreenInfo = fullscreenState.get();
  const editorBody = Element.fromDom(editor.getBody());

  const isTouch = Env.deviceType.isTouch();

  editorContainerStyle = editorContainer.style;
  iframe = editor.getContentAreaContainer().firstChild;
  iframeStyle = iframe.style;

  if (!fullscreenInfo) {
    const newFullScreenInfo = {
      scrollPos: getScrollPos(),
      containerWidth: editorContainerStyle.width,
      containerHeight: editorContainerStyle.height,
      containerTop: editorContainerStyle.top,
      containerLeft: editorContainerStyle.left,
      iframeWidth: iframeStyle.width,
      iframeHeight: iframeStyle.height
    };

    if (isTouch) {
      Thor.clobberStyles(editorContainerS, editorBody);
    }

    iframeStyle.width = iframeStyle.height = '100%';
    editorContainerStyle.width = editorContainerStyle.height = '';

    DOM.addClass(body, 'tox-fullscreen');
    DOM.addClass(documentElement, 'tox-fullscreen');
    DOM.addClass(editorContainer, 'tox-fullscreen');

    viewportUpdate.bind(editorContainerS);

    editor.on('remove', viewportUpdate.unbind);

    fullscreenState.set(newFullScreenInfo);
    Events.fireFullscreenStateChanged(editor, true);
  } else {
    iframeStyle.width = fullscreenInfo.iframeWidth;
    iframeStyle.height = fullscreenInfo.iframeHeight;

    editorContainerStyle.width = fullscreenInfo.containerWidth;
    editorContainerStyle.height = fullscreenInfo.containerHeight;
    editorContainerStyle.top = fullscreenInfo.containerTop;
    editorContainerStyle.left = fullscreenInfo.containerLeft;

    if (isTouch) {
      Thor.restoreStyles();
    }
    DOM.removeClass(body, 'tox-fullscreen');
    DOM.removeClass(documentElement, 'tox-fullscreen');
    DOM.removeClass(editorContainer, 'tox-fullscreen');
    setScrollPos(fullscreenInfo.scrollPos);

    fullscreenState.set(null);
    Events.fireFullscreenStateChanged(editor, false);
    viewportUpdate.unbind();
    editor.off('remove', viewportUpdate.unbind);
  }
};

export default {
  toggleFullscreen
};
