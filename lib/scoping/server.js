export const extendPublish = (newPublishArguments) => {
  // DDP Server constructor.
  const Server = Object.getPrototypeOf(Meteor.server).constructor;

  const originalPublish = Server.prototype.publish;
  Server.prototype.publish = async function (...args) {
    // If the first argument is an object, we let the original publish function to traverse it.
    if (typeof args[0] === 'object' && args[0] !== null) {
      await originalPublish.apply(this, args);
      return;
    }

    const newArgs = await newPublishArguments.apply(this, args);

    await originalPublish.apply(this, newArgs);
  };

  // Because Meteor.publish is a bound function it remembers old
  // prototype method so we have to wrap it directly as well.
  const originalMeteorPublish = Meteor.publish;
  Meteor.publish = function (...args) {
    // If the first argument is an object, we let the original publish function to traverse it.
    if (typeof args[0] === 'object' && args[0] !== null) {
      originalMeteorPublish.apply(this, args);
      return;
    }

    const newArgs = newPublishArguments.apply(this, args);

    originalMeteorPublish.apply(this, newArgs);
  };
};

// Extend publish part

extendPublish(function (name, func, options) {
  const newFunc = function (...args) {
    const publish = this;

    const scopeFieldName = `_sub_${publish._subscriptionId}`;

    let enabled = false;
    publish.enableScope = function () {
      enabled = true;
    };

    const originalAdded = publish.added;
    publish.added = function (collectionName, id, fields) {
      // Add our scoping field.
      if (enabled) {
        fields = { ...fields };
        fields[scopeFieldName] = 1;
      }

      originalAdded.call(this, collectionName, id, fields);
    };

    const originalChanged = publish.changed;
    publish.changed = function (collectionName, id, fields) {
      // We do not allow changes to our scoping field.
      if (enabled && scopeFieldName in fields) {
        fields = { ...fields };
        delete fields[scopeFieldName];
      }

      originalChanged.call(this, collectionName, id, fields);
    };

    return func.apply(publish, args);
  };

  return [name, newFunc, options];
});
