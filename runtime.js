// Tiny template runtime: renders the prototype's {{ }} / <sc-if> / <sc-for> markup with Preact.
import { h, Component } from 'preact';

const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
const WHOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;

function lookup(path, scopes) {
  if (path === 'true') return true;
  if (path === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
  const parts = path.split('.');
  for (let i = scopes.length - 1; i >= 0; i--) {
    const sc = scopes[i];
    if (sc && Object.prototype.hasOwnProperty.call(sc, parts[0])) {
      let v = sc[parts[0]];
      for (let j = 1; j < parts.length; j++) { if (v == null) return undefined; v = v[parts[j]]; }
      return v;
    }
  }
  return undefined;
}
function interp(str, scopes) {
  const m = str.match(WHOLE);
  if (m) return lookup(m[1], scopes);
  return str.replace(HOLE, (_, p) => { const v = lookup(p, scopes); return v == null ? '' : String(v); });
}

let tplRoot = null;
export function setTemplate(html) {
  const doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
  tplRoot = doc.body;
}

function renderChildren(nodes, scopes, out) {
  for (const n of nodes) {
    if (n.nodeType === 3) {
      const txt = n.nodeValue;
      if (!txt.trim()) { if (txt.length) out.push(' '); continue; }
      out.push(txt.indexOf('{{') >= 0 ? interp(txt, scopes) : txt);
      continue;
    }
    if (n.nodeType !== 1) continue;
    const tag = n.localName;
    if (tag === 'sc-if') {
      if (interp(n.getAttribute('value') || '', scopes)) renderChildren(n.childNodes, scopes, out);
      continue;
    }
    if (tag === 'sc-for') {
      const list = interp(n.getAttribute('list') || '', scopes) || [];
      const as = n.getAttribute('as') || 'item';
      list.forEach((item, i) => renderChildren(n.childNodes, scopes.concat([{ [as]: item, $index: i }]), out));
      continue;
    }
    const props = {};
    const isField = tag === 'input' || tag === 'textarea';
    for (const a of n.attributes) {
      let name = a.name;
      if (name.startsWith('hint-')) continue;
      let val = a.value.indexOf('{{') >= 0 ? interp(a.value, scopes) : a.value;
      if (name.startsWith('on')) {
        if (typeof val !== 'function') continue;
        if (isField && name === 'onchange') name = 'oninput';
      }
      if (name === 'value' && val == null) val = '';
      props[name] = val;
    }
    const kids = [];
    renderChildren(n.childNodes, scopes, kids);
    out.push(h(tag, props, kids));
  }
}

export class DCLogic extends Component {
  render() {
    const out = [];
    renderChildren(tplRoot.childNodes, [this.renderVals()], out);
    const els = out.filter((x) => typeof x !== 'string' || x.trim());
    return els.length === 1 ? els[0] : h('div', { style: 'height:100%' }, els);
  }
}
