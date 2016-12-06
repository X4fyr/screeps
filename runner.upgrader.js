const spawnerRunner = require('runner.spawner');
const energyProvider = require('provider.energy');

const UPGRADER_PER_ROOM = 4;
const ROLE_NAME = "upgrader";

/**
 * @type {{rooms:Array<{roomName:String, creeps: String[]}>}} memory
 */
let memory = {};


const upgraderRunner = {
    init: function () {
        memory = Memory.runner.upgrader;
        missingCreepsRunner();
        assignCreeps();
    },
    run: function () {
        creepRunner();

        Memory.runner.upgrader = memory;
    }
};

const creepRunner = function () {
    for (let roomTask of memory.rooms) {
        for (let creepId of roomTask.creeps) {
            /** @type {Creep} */ const creep = Game.getObjectById(creepId);
            /** @type {Room} */ const room = Game.rooms[roomTask.roomName];
            if (creep.pos.roomName != roomTask.roomName) {
                creep.moveTo(room.controller);
            } else if (creep.carry.energy == 0 && !creep.memory.refilling) {
                creep.memory.refilling = true;
                creep.say('refilling');
            } else if (creep.memory.refilling) {
                const result = energyProvider.refill(creep);
                if (result == null) {
                    creep.say('nfs');
                }
                creep.memory.refilling = result;
            }
            if (!creep.memory.refilling && creep.upgradeController(room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(room.controller);
            }
        }
    }
};

const assignCreeps = function () {
    const creeps = Game.creeps;
    for (let creepIdx in creeps) {
        if (!creeps.hasOwnProperty(creepIdx)) continue;
        const creep = creeps[creepIdx];
        if (creep.memory.role == ROLE_NAME && creep.memory.unassigned == true) {
            for (let roomTask of memory.rooms) {
                if (roomTask.roomName == creep.memory.roomName) {
                    roomTask.creeps.push(creep.id);
                    delete creep.memory.unassigned;
                }
            }
        }
    }
};

const missingCreepsRunner = function () {
    for (let roomTask of memory.rooms) {
        if (!roomTask.creeps) {
            roomTask.creeps = [];
        }
        roomTask.creeps = roomTask.creeps.filter(id => Game.getObjectById(id));
        if (roomTask.creeps.length < UPGRADER_PER_ROOM / 2) {
            spawnerRunner.registerMissingCreep(ROLE_NAME, [WORK, WORK, CARRY, CARRY, MOVE, MOVE], {
                roomName: roomTask.roomName,
                unassigned: true
            }, roomTask.roomName, 3);
        } else if (roomTask.creeps.length < UPGRADER_PER_ROOM) {
            //spawnerRunner.registerMissingCreep(ROLE_NAME, [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY,
            // CARRY, MOVE, MOVE, MOVE, MOVE, MOVE], {
            spawnerRunner.registerMissingCreepRatio(ROLE_NAME, [{part: WORK, ratio: 2}, {part: CARRY, ratio: 1}], 1,
                null, {roomName: roomTask.roomName, unassigned: true}, roomTask.roomName, 2);
        }
    }
};

module.exports = upgraderRunner;