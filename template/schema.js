// small helpers for the JSON schemas in template/*.js
const str = { type: 'string' }, num = { type: 'number' }, int = { type: 'integer' };
const obj = props => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
const list = items => ({ type: 'array', items });
const base = { duration: num, voice: str };
const tag = obj({ icon: str, text: str });
module.exports = { str, num, int, obj, list, base, tag };
