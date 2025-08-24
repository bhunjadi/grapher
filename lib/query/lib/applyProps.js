import { omit } from '../../utils.js';

const restrictOptions = [
  'disableOplog',
  'pollingIntervalMs',
  'pollingThrottleMs',
];

export default function applyProps(node) {
  let filters = Object.assign({}, node.props.$filters);
  let options = Object.assign({}, node.props.$options);

  options = omit(options, ...restrictOptions);
  options.fields = options.fields || {};

  node.applyFields(filters, options);

  return { filters, options };
}
