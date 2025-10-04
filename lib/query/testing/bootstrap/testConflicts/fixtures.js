import TestConflicts from './collection.js';

export default async () => {
    // Create test documents for field name conflict testing
    const testConflictId1 = await TestConflicts.insertAsync({
        name: 'Test Conflict 1',
        description: 'Document for testing field name conflicts',
        profile: {
            firstName: 'John',
            lastName: 'Doe'
        }
    });

    const testConflictId2 = await TestConflicts.insertAsync({
        name: 'Test Conflict 2', 
        description: 'Another document for testing',
        profile: {
            firstName: 'Jane',
            lastName: 'Smith'
        }
    });

    return {
        testConflictId1,
        testConflictId2
    };
};
