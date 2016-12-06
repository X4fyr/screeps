const spawnerRunner = require('runner.spawner');

/**
 * @typedef {{occupation: number, space: number, container: String, assigned: String[]}} sourceInformation
 * @type {{rooms:Object<String,Object<String,sourceInformation>>}}
 */
let memory = {};

/**
 * @type {{rooms:{roomName: string, healthState: {existingCreeps: number}}}}
 */
let local = {};

const creepsRunner = function () {
    for (let roomName in memory.rooms) {
        if (!memory.rooms.hasOwnProperty(roomName)) continue;
        for (let sourceId in memory.rooms[roomName]) {
            if (!memory.rooms[roomName].hasOwnProperty(sourceId)) continue;
            const mSource = memory.rooms[roomName][sourceId];
            const source = Game.getObjectById(sourceId);
            const container = Game.getObjectById(mSource.container);
            for (let idx in mSource.assigned) {
                const creepId = mSource.assigned[idx];
                const creep = Game.getObjectById(creepId);
                if (creep && creep.carry.energy < creep.carryCapacity) {
                    const result = creep.harvest(source);
                    if (result == ERR_NOT_IN_RANGE) {
                        creep.moveTo(source);
                    } else if (result == ERR_NOT_ENOUGH_RESOURCES && creep.carry.energy > 0) {
                        if (creep.transfer(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(container);
                        }
                    }
                } else {
                    if (creep && creep.transfer(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(container);
                    }
                }
            }
        }
    }
};
const registerSources = function (room) {
    const sources = room.find(FIND_SOURCES);
    if (memory.rooms[room.name]) {
        delete memory.rooms[room.name];
    }
    memory.rooms[room.name] = {};
    for (let idx in sources) {
        if (!sources.hasOwnProperty(idx)) continue;
        const source = sources[idx];
        memory.rooms[room.name][source.id] = {};
        memory.rooms[room.name][source.id].occupation = 0;
        memory.rooms[room.name][source.id].assigned = [];

        //count non-wall around source
        let spaceCounter = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (!(i == 0 && j == 0) && Game.map.getTerrainAt(source.pos.x + i, source.pos.y + j, source.pos.roomName) != 'wall') {
                    spaceCounter++;
                }
            }
        }
        memory.rooms[room.name][source.id].space = spaceCounter;

        //Find next container
        const nextContainer = source.pos.findClosestByRange(FIND_STRUCTURES, {filter: struct => struct.structureType == STRUCTURE_CONTAINER});
        if (nextContainer) {
            memory.rooms[room.name][source.id].container = nextContainer.id;
        }
    }
};
const loadFromMemory = function () {
    if (Memory.runner.sources) {
        memory = Memory.runner.sources;
    } else {
        console.log('Recreate source memory.');
        if (memory.rooms) {
            delete memory.rooms;
        }
        memory.rooms = {};
        for (let idx in Game.rooms) {
            if (!Game.rooms.hasOwnProperty(idx)) continue;
            registerSources(Game.rooms[idx]);
        }
    }
};
const assignCreepsToSources = function () {
    const creeps = Game.creeps;
    for (let idx in creeps) {
        if (!creeps.hasOwnProperty(idx)) continue;
        if (creeps[idx].memory.role == 'containerHarvester' && creeps[idx].memory.unassigned == true) {
            const creep = creeps[idx];
            delete creep.memory.unassigned;
            memory.rooms[creep.memory.room][creep.memory.source].assigned.push(creep.id);
        }

    }
};
const missingCreepsRunner = function () {
    for (let roomName in memory.rooms) {
        if (!memory.rooms.hasOwnProperty(roomName)) continue;
        for (let mSourceId in memory.rooms[roomName]) {
            if (!memory.rooms[roomName].hasOwnProperty(mSourceId)) continue;
            const mSource = memory.rooms[roomName][mSourceId];
            if (mSource.container && Game.getObjectById(mSource.container)) {
                if (!mSource.assigned) {
                    mSource.assigned = [];
                }
                memory.rooms[roomName][mSourceId].assigned = mSource.assigned = mSource.assigned.filter(creepId => Game.getObjectById(creepId) instanceof Creep);
                if (mSource.assigned.length < 1) {
                    spawnerRunner.registerMissingCreep('containerHarvester', [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE], {
                        source: mSourceId,
                        room: roomName,
                        unassigned: true
                    }, roomName, 3);
                } else {
                    if (!local.rooms.hasOwnProperty(roomName)) {
                        local.rooms[roomName] = {healthState: {existingCreeps: 0}};
                    }
                    local.rooms[roomName].healthState.existingCreeps++;
                }
            }
        }
    }
};
const saveToMemory = function () {
    Memory.runner.sources = memory;
};
const sourcesRunner = {
    init: function () {
        local = {rooms: {}};
        for (const roomName in memory.rooms) {
            if (!memory.rooms.hasOwnProperty(roomName)) continue;
            local.rooms[roomName] = {healthState: {existingCreeps: 0}};
        }
        loadFromMemory();
        missingCreepsRunner();
        assignCreepsToSources();
    },
    run: function () {
        creepsRunner();
        saveToMemory();
    },
    /**
     * Return the health state of the room regarding source harvesting
     * @param roomName
     * @return {?number} A number between 0 and 3. 0 -> critical, 1 -> bad, 2 -> medium, 3 -> good. null if room not found.
     */
    healthState: function (roomName) {
        if (!Game.rooms.hasOwnProperty(roomName)) {
            console.log('No source health state information for room ' + roomName);
            return null;
        }
        if (!local.rooms.hasOwnProperty(roomName)) return 0;
        const ratio = local.rooms[roomName].healthState.existingCreeps / Game.rooms[roomName].find(FIND_SOURCES).length;
        if (ratio > 3/4) {
            return 3;
        } else if (ratio > 2/4) {
            return 2;
        } else if (ratio > 1/4) {
            return 1;
        } else {
            return 0;
        }
    }
};


module.exports = sourcesRunner;