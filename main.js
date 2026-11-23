import { h, render } from 'preact';
import { setTemplate } from './runtime.js';
import Component from './logic.js';
import TEMPLATE from './template.html';
setTemplate(TEMPLATE);
render(h(Component, {}), document.getElementById('root'));
