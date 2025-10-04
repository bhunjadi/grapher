export default async function applyReducers(root, params) {
     // Process each collection node asynchronously
     await Promise.all(
        Object.values(root.collectionNodes).map(async (node) => {
            await applyReducers(node, params);
        })
    );

    const processedReducers = [];
    let reducersQueue = [...root.reducerNodes];
    
    // Cycle detection: track reducers that have been requeued
    const requeuedReducers = new Map(); // reducer name -> requeue count

    while (reducersQueue.length) {
        const reducerNode = reducersQueue.shift();

        // If this reducer depends on other reducers
        if (reducerNode.dependencies.length) {
            // Check for self-dependency (most common cycle case)
            if (reducerNode.dependencies.includes(reducerNode.name)) {
                throw new Meteor.Error(
                    'reducer-self-dependency',
                    `Reducer "${reducerNode.name}" cannot depend on itself. ` +
                    `This happens when a reducer has the same name as a field it uses in its body. ` +
                    `Consider renaming the reducer or using a different field name.`,
                    {
                        reducerName: reducerNode.name,
                        dependencies: reducerNode.dependencies,
                        collectionName: root.collection._name
                    }
                );
            }

            // If there is an unprocessed reducer, move it at the end of the queue
            const allDependenciesComputed = reducerNode.dependencies.every(dep => 
                processedReducers.includes(dep)
            );
            if (allDependenciesComputed) {
                // Process results asynchronously
                await Promise.all(root.results.map(async (result) => {
                    await reducerNode.compute(result, params);
                }));
                processedReducers.push(reducerNode.name);
                
                // Reset requeue count on successful processing
                requeuedReducers.delete(reducerNode.name);
            } else {
                // Track requeue attempts for cycle detection
                const requeueCount = (requeuedReducers.get(reducerNode.name) || 0) + 1;
                requeuedReducers.set(reducerNode.name, requeueCount);
                
                // If we've requeued this reducer too many times, it's likely a cycle
                const maxRequeues = reducersQueue.length * 2; // Allow reasonable retries
                if (requeueCount > maxRequeues) {
                    // Find the cycle by analyzing dependencies
                    const cycle = detectReducerCycle(reducerNode, root.reducerNodes, processedReducers);
                    
                    throw new Meteor.Error(
                        'reducer-dependency-cycle',
                        `Circular dependency detected in reducers: ${cycle.join(' -> ')}. ` +
                        `This often happens when reducers have the same name as fields they depend on. ` +
                        `Please check your reducer definitions and rename conflicting reducers.`,
                        {
                            cycle,
                            reducerName: reducerNode.name,
                            dependencies: reducerNode.dependencies,
                            collectionName: root.collection._name,
                            processedReducers,
                            remainingReducers: reducersQueue.map(r => r.name)
                        }
                    );
                }
                
                // Move it at the end of the queue
                reducersQueue.push(reducerNode);
            }
        } else {
             // Process results asynchronously
            await Promise.all(root.results.map(async (result) => {
                await reducerNode.compute(result, params);
            }));

            processedReducers.push(reducerNode.name);
            
            // Reset requeue count on successful processing
            requeuedReducers.delete(reducerNode.name);
        }
    }
}

/**
 * Detects and returns a circular dependency path in reducer dependencies
 * @param {Object} startingReducer - The reducer that triggered cycle detection
 * @param {Array} allReducers - All reducer nodes
 * @param {Array} processedReducers - Already processed reducer names
 * @returns {Array} Array of reducer names forming the cycle
 */
function detectReducerCycle(startingReducer, allReducers, processedReducers) {
    const reducerMap = new Map();
    allReducers.forEach(reducer => {
        reducerMap.set(reducer.name, reducer);
    });
    
    const visited = new Set();
    const recursionStack = new Set();
    const path = [];
    
    function dfs(reducerName) {
        // Skip already processed reducers
        if (processedReducers.includes(reducerName)) {
            return null;
        }
        
        if (recursionStack.has(reducerName)) {
            // Found a cycle - return the cycle path
            const cycleStart = path.indexOf(reducerName);
            return path.slice(cycleStart).concat([reducerName]);
        }
        
        if (visited.has(reducerName)) {
            return null;
        }
        
        visited.add(reducerName);
        recursionStack.add(reducerName);
        path.push(reducerName);
        
        const reducer = reducerMap.get(reducerName);
        if (reducer && reducer.dependencies) {
            for (const dependency of reducer.dependencies) {
                const cycle = dfs(dependency);
                if (cycle) {
                    return cycle;
                }
            }
        }
        
        recursionStack.delete(reducerName);
        path.pop();
        return null;
    }
    
    // Start DFS from the problematic reducer
    const cycle = dfs(startingReducer.name);
    return cycle || [startingReducer.name]; // Fallback to single reducer if cycle detection fails
}
