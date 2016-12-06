/**
 * @typedef {(WORK|CARRY|ATTACK|RANGED_ATTACK|TOUGH|HEAL|CLAIM)} nonMoveBodyparts
 * @typedef {(MOVE|WORK|CARRY|ATTACK|RANGED_ATTACK|TOUGH|HEAL|CLAIM)} bodyparts
 * @typedef {{role: String, body: bodyparts[], memory: Object}} spawnTask;
 */


/** @type {{rooms: String[]}} */
let memory = {};

let local = {
    queue: [],
    queues: {
        /** @type {spawnTask[]} 1*/
        1: [],
        /** @type {spawnTask[]} 2*/
        2: [],
        /** @type {spawnTask[]} 3*/
        3: [],
        /** @type {spawnTask[]} 4*/
        4: []
    },
    /**@type {{roomName: String, queues: {1: spawnTask[], 2: spawnTask[], 3: spawnTask[], 4: spawnTask[]}}}*/
    rooms: {}

};

/**
 * Spawn a new creep.
 * @param {string} role - role of this creep
 * @param {bodyparts[]} body - array of bodyparts
 * @param {Object} memory - object containing the future memory. role attribute is automatically added
 * @param {StructureSpawn} spawn - Spawn building
 * @returns {string} name of the new creep
 */
const spawn = function (role, body, memory, spawn) {
    const newName = role + '-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        }); // Create name with UUID
    const roleMemory = {role: role};
    for (let name in memory) {
        roleMemory[name] = memory[name];
    }
    return spawn.createCreep(body, newName, roleMemory);
};
const spawnerRunner = {
    init: function () {
        memory = Memory.runner.spawner;
        local = {
            queue: [],
            queues: {
                1: [],
                2: [],
                3: [],
                4: []
            },
            rooms: {}
        };
        for (const roomName of memory.rooms) {
            local.rooms[roomName] = {
                roomName: roomName,
                queues: {1: [], 2: [], 3: [], 4: []}
            };
        }
    },
    run: function () {
        for (const roomTaskIdx in local.rooms) {
            if (!local.rooms.hasOwnProperty(roomTaskIdx)) continue;
            const roomTask = local.rooms[roomTaskIdx];
            if (!Game.rooms.hasOwnProperty(roomTask.roomName)) {
                console.log('spawnerRunner: room ' + roomTask.roomName + ' not known.');
                return;
            }
            const spawnBuilding = Game.rooms[roomTask.roomName].find(FIND_MY_SPAWNS)[0];
            if (!spawnBuilding) {
                console.log('spawnerRunner: room ' + roomTask.roomName + ' has no spawn.');
                return;
            }
            /**@type{spawnTask[]}*/let queue = roomTask.queues[4].concat(roomTask.queues[3], roomTask.queues[2],
                roomTask.queues[1]).filter(it => it != null);
            if (Game.time % 10 == 0) {
                console.log(roomTask.roomName + ': Spawn queue length: ' + queue.length);
                for (let priority in roomTask.queues) {
                    if (!roomTask.queues.hasOwnProperty(priority)) continue;
                    if (roomTask.queues[priority].length > 0) {
                        console.log(priority + ": " + roomTask.queues[priority].map(elem => elem.role));
                    }
                }
                Game.notify(roomTask.roomName + ': Spawn queue length: ' + queue.length, 180);
            }
            /**@type{spawnTask}*/ let task;
            while (task = queue.shift()) {
                const name = spawn(task.role, task.body, task.memory, spawnBuilding);
                if (!(name < 0)) {
                    console.log(roomTask.roomName + ': Spawn a ' + task.role + ' with name ' + name);
                } else if (name != ERR_BUSY && name != ERR_NOT_ENOUGH_ENERGY) {
                    console.log('spawnerRunner: ' + roomTask.roomName + ": Error spawning: " + name);
                }
            }
        }

        //Cleanup
        for (let name in Memory.creeps) {
            if(!Memory.creeps.hasOwnProperty(name)) continue;
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
    }
    ,
    /**
     * Enqueue a new creep to spawn.
     * @param {String} role - role of this creep
     * @param {String[]} body - array of bodyparts
     * @param {Object} memory - object containing the future memory. role attribute is automatically added
     * @param {String} roomName
     * @param {number} [priority=2] - optional priority 1-4. The greater the number the higher the priority Default: 2;
     */
    registerMissingCreep: function (role, body, memory, roomName, priority) {
        if (!priority || priority < 1 || priority > 4) {
            priority = 2;
        }
        if (!local.rooms.hasOwnProperty(roomName)) {
            console.log('spawnerRunner: Trying to spawn in non spawning room.');
            return;
        }
        local.rooms[roomName].queues[priority].push({role: role, body: body, memory: memory});
    },
    /**
     * Enqueue a new creep to spawn giving dynamic numbers of bodyparts.
     * @param {String} role - role of this creep
     * @param {Array<{part: nonMoveBodyparts, ratio: number}>} ratios
     * @param {Number} moveState What states of move actions should be available: 0 -> stationary(always a single MOVE), 1 -> road(1:2 MOVE), 2 -> off road (1:1 MOVE)
     * @param {?Number} maxCost max limit of cost, null if unlimited
     * @param {Object} memory - object containing the future memory. role attribute is automatically added
     * @param {String} roomName
     * @param {number} [priority=2] - optional priority 1-4. The greater the number the higher the priority Default: 2;
     */
    registerMissingCreepRatio: function (role, ratios, moveState, maxCost, memory, roomName, priority) {
        if (!priority || priority < 1 || priority > 2) {
            priority = 2;
        }
        if (!local.rooms.hasOwnProperty(roomName)) {
            console.log('spawnerRunner: Trying to spawn in non spawning room.');
            return;
        }
        if (!Game.rooms.hasOwnProperty(roomName)) {
            console.log('spawnerRunner: room ' + roomName + 'not known.');
        }
        local.rooms[roomName].queues[priority].push({
            role: role,
            body: calculateBodyParts(ratios, moveState, maxCost, Game.rooms[roomName].energyCapacityAvailable),
            memory: memory
        });
        
    },
    /**
     * Return the length of a queue with given priority
     * @param {String} roomName name of the room
     * @param {number} priority Priority of the queue wanted
     * @returns {?Number}
     */
    queueState: function (roomName, priority) {
        if (!local.rooms.hasOwnProperty(roomName)) {
            console.log('spawnerRunner: Tryign to access state of unknow room ' + roomName);
            return null;
        }
        return local.rooms[roomName].queues[priority].length;
    }
};

/**
 * @param {Array<{part: nonMoveBodyparts, ratio: number}>} ratios
 * @param {Number} moveState What states of move actions should be available: 0 -> stationary(always a single MOVE), 1 -> road(1:2 MOVE), 2 -> off road (1:1 MOVE)
 * @param {?Number} maxCost max limit of cost, null if unlimited
 * @param {Number} availableEnergy extensions + spawn
 * @returns {bodyparts[]} The absolute number of body parts
 */
const calculateBodyParts = function (ratios, moveState, maxCost, availableEnergy) {
    if (maxCost == null) {
        maxCost = availableEnergy;
    }
    /**@type {bodyparts[]}*/let body = Array();
    ratios = ratios.filter(it => it.part && it.ratio);
    if (ratios.length != 0) {
        const usableEnergy = Math.min(maxCost, availableEnergy);
        //Calculus: x*sum1(BODYPART_COST[bodypart]*bodypartRatio + moveRatio*sum2(bodypartRatio)*BODYPART_COST[MOVE]) = usableEnergy => x = usableEnergy/(sum(...)+sum2()*..*..)
        let sum1 = 0;
        ratios.forEach(it => sum1 += BODYPART_COST[it.part] * it.ratio);
        let sum2;
        let x;
        let moveCount;
        if (moveState == 0) {
            x = Math.floor(usableEnergy / (sum1 + BODYPART_COST[MOVE]));
            moveCount = 1;
        } else if (moveState == 1) {
            sum2 = 0;
            ratios.forEach(it => sum2 += it.ratio);
            x = Math.floor(usableEnergy / (sum1 + sum2 * BODYPART_COST[MOVE] / 2));
            let partNumber = x * sum2;
            if (partNumber % 2 != 0) {
                partNumber++;
            }
            moveCount = partNumber / 2;
        } else if (moveState == 2) {
            sum2 = 0;
            ratios.forEach(it => sum2 += it.ratio);
            x = Math.floor(usableEnergy / (sum1 + sum2 * BODYPART_COST[MOVE]));
            moveCount = x * sum2;
        } else {
            return null;
        }
        for (let pair of ratios) {
            const count = pair.ratio * x;
            //noinspection JSPotentiallyInvalidConstructorUsage
            body.push([...Array(count)].map(it => pair.part))
        }
        //noinspection JSPotentiallyInvalidConstructorUsage
        body.push([...Array(moveCount)].map(it => MOVE));
    }
    body = body.reduce((a,b) => a.concat(b)).filter(it => it && it != '');
    return body;
};


module.exports = spawnerRunner;