import TestConflicts from './collection.js';

// This collection is specifically for testing field name conflicts and self-dependent reducers
TestConflicts.addReducers({
    // PROBLEMATIC: Reducer with same name as existing field 'name' that references itself
    name: {
      body: {
        name: 1,  // THIS CAUSES THE INFINITE LOOP: reducer 'name' depends on field 'name'
        profile: {
          firstName: 1
        }
      },
      reduce(object) {
        // Transform the actual 'name' field
        return `REDUCED: ${object.name} (${object.profile?.firstName})`;
      }
    },

    // PROBLEMATIC: Reducer with nested field self-dependency
    profile: {
      body: {
        profile: 1  // THIS CAUSES SELF-DEPENDENCY: reducer 'profile' depends on field 'profile'
      },
      reduce(object) {
        return {
          processed: true,
          original: object.profile
        };
      }
    },

    // Async reducer with same name as a field that might exist
    createdAt: {
      body: {
        _id: 1  // Use _id instead of name to avoid self-dependency
      },
      async reduce(object) {
        // Simulate async processing
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          reducerGenerated: true,
          timestamp: new Date(),
          basedOnName: object._id,  // Use _id instead of name to avoid self-dependency
          type: 'async-reducer-createdAt'
        };
      }
    },

    // Non-problematic reducer for testing
    simpleNameConflict: {
      body: {
        _id: 1,
        description: 1
      },
      reduce(object) {
        return `Simple: ${object._id} - ${object.description}`;
      }
    }
});
