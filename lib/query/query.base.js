import deepClone from 'lodash.clonedeep';
import { check } from 'meteor/check';

/**
 * @template T
 * @template {Grapher.Params} P Params type
 */
export default class QueryBase {
  isGlobalQuery = true;

  /**
   *
   * @param {Mongo.Collection<T>} collection
   * @param {Grapher.Body<T>} body
   * @param {Grapher.QueryOptions<T>} options
   */
  constructor(collection, body, options = {}) {
    this.collection = collection;

    this.body = deepClone(body);

    this.params = options.params || {};
    this.options = options;
  }

  /**
   *
   * @param {P} newParams
   * @returns
   */
  clone(newParams) {
    const params = Object.assign({}, deepClone(this.params), newParams);

    return new this.constructor(this.collection, deepClone(this.body), {
      params,
      ...this.options,
    });
  }

  get name() {
    return `exposure_${this.collection._name}`;
  }

  /**
   * Validates the parameters
   */
  doValidateParams() {
    const { validateParams } = this.options;
    if (!validateParams) return;

    if (typeof validateParams === 'function') {
      validateParams.call(null, this.params);
    } else {
      check(this.params);
    }
  }

  /**
   * Merges the params with previous params.
   *
   * @param {P} params
   * @returns {this}
   */
  setParams(params) {
    this.params = Object.assign({}, this.params, params);

    return this;
  }
}
