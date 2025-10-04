import deepClone from 'lodash.clonedeep';
import { check } from 'meteor/check';
import { isFunction } from '../utils.js';

/**
 * @type {Partial<Grapher.QueryOptions<unknown, unknown>}
 */
let globalConfig = {};

/**
 * @template T
 * @template {Grapher.Params} P Params type
 *
 */
export default class NamedQueryBase {
  /**
   * @param {Partial<Grapher.QueryOptions<unknown, unknown>} config
   */
  static setConfig(config) {
    globalConfig = config;
  }

  static getConfig() {
    return globalConfig;
  }

  isNamedQuery = true;

  /**
   * @param {string} name
   * @param {Mongo.Collection<T>} collection
   * @param {Grapher.Body<T>} body
   * @param {Grapher.QueryOptions<T, P>} options
   */
  constructor(name, collection, body, options = {}) {
    this.queryName = name;

    if (isFunction(body)) {
      this.resolver = body;
    } else {
      this.body = deepClone(body);
    }

    /**
     *  @type {Meteor.SubscriptionHandle | null}
     */
    this.subscriptionHandle = null;
    /**
     * @type {P}
     */
    this.params = options.params || {};
    /**
     * @type {Grapher.QueryOptions<T, P>}
     */
    this.options = Object.assign({}, globalConfig, options);

    /**
     * @type {Mongo.Collection<T>}
     */
    this.collection = collection;

    /**
     * @type {boolean}
     */
    this.isExposed = false;

    /**
     * Server only
     * @type {Grapher.ExposureConfig | null}
     */
    this.exposeConfig = null;
  }

  get name() {
    return `named_query_${this.queryName}`;
  }

  get isResolver() {
    return !!this.resolver;
  }

  /**
   * @param {P} params
   * @returns
   */
  setParams(params) {
    this.params = Object.assign({}, this.params, params);

    return this;
  }

  /**
   * Validates the parameters
   * @param {P} params
   *
   * @returns {void}
   */
  doValidateParams(params) {
    params = params || this.params;

    const { validateParams } = this.options;
    if (!validateParams) return;

    try {
      this._validate(validateParams, params);
    } catch (validationError) {
      console.error(
        `Invalid parameters supplied to the query "${this.queryName}"\n`,
        validationError,
      );
      throw validationError; // rethrow
    }
  }
  /**
   * @param {P} newParams
   * @returns
   */
  clone(newParams) {
    const params = Object.assign({}, deepClone(this.params), newParams);

    /**
     * @type {Grapher.NamedQueryBaseClass<T, P>}
     */
    let clone = new this.constructor(
      this.queryName,
      this.collection,
      this.isResolver ? this.resolver : deepClone(this.body),
      {
        ...this.options,
        params,
      },
    );

    clone.cacher = this.cacher;
    if (this.exposeConfig) {
      clone.exposeConfig = this.exposeConfig;
    }

    return clone;
  }

  /**
   * @param {Grapher.ValidateParamsParam} validator
   * @param {P} params
   * @returns {void}
   * @private
   */
  _validate(validator, params) {
    if (isFunction(validator)) {
      validator.call(null, params);
    } else {
      check(params, validator);
    }
  }
}

NamedQueryBase.defaultOptions = {};
