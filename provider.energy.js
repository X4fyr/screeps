const sourcesRunner = require('runner.sources');

/**
 * @typedef {{reserved: number, target: String}} creepInformation
 * @typedef {{reserved: number}} storageInformation
 * @typedef {{storages: Object<String,storageInformation>}} roomInformation
 * @type {{rooms:Object<string,roomInformation>, creeps: Object<String,creepInformation}}
 */
let memory = {};

/**
 * @typedef {{occupation: number, space: number, container: String, assigned: String[]}} sourceInformation
 * @type {{rooms:Object<String,Object<String,sourceInformation>>}}
 */
let sourceMemory = {};

const energyProvider = {
    init: function () {
        memory = Memory.provider.energy;
        sourceMemory = Memory.runner.sources;
        validateMemory();
    },
    /**
     * Instruct a creep to refill in its current room.
     * @param {Creep} creep Creep to refill
     * @return {?Boolean} State of refilling: true if refilling, false if full, null if room not registered or without energy to refill
     */
    refill: function (creep) {
        /**@type {?Boolean}*/ const refilling = refillRoutine(creep);
        //Cleanup if finished filling.
        if (refilling == null) return null;
        if (!refilling) {
            if (memory.creeps.hasOwnProperty(creep.id)) {
                /**@type {creepInformation}*/ const creepInfo = memory.creeps[creep.id];
                /**@type {String}*/ const roomName = Game.getObjectById(creepInfo.target).pos.roomName;
                /**@type {roomInformation}*/ const roomInfo = memory.rooms[roomName];
                if (roomInfo && roomInfo.storages.hasOwnProperty(creepInfo.target)) {
                    roomInfo.storages[creepInfo.target].reserved -= creepInfo.reserved;
                } else if (sourceMemory.rooms.hasOwnProperty(roomName) && sourceMemory.rooms[roomName].hasOwnProperty(creepInfo.target)) {
                    sourceMemory.rooms[roomName][creepInfo.target].occupation--;
                }
                delete memory.creeps[creep.id]
            }
        }
        return refilling;
    },
    /**
     * Reserve and withdraw energy that isn't reserved.
     * @param {Creep} creep
     * @param {(StructureContainer|StructureStorage)} storage
     * @return {?(number|OK|ERR_NOT_OWNER|ERR_BUSY|ERR_NOT_ENOUGH_RESOURCES|ERR_INVALID_TARGET|ERR_FULL|ERR_NOT_IN_RANGE|ERR_INVALID_ARGS)} result of Creep.harvest, ERR_NOT_ENOUGH_RESOURCES if all energy reserved, null if storage not registered
     */
    getUnreserved: function (creep, storage) {
        /**@type {String}*/ const roomName = storage.pos.roomName;
        if (!memory.rooms.hasOwnProperty(roomName) || !memory.rooms[roomName].storages.hasOwnProperty(storage.id)) {
            return null;
        }
        /**@type {storageInformation}*/ const storageInfo = memory.rooms[roomName].storages[storage.id];
        /**@type {number}*/ const availableEnergy = storage.store.energy - storageInfo.reserved;
        if (availableEnergy < 0) {
            return ERR_NOT_ENOUGH_RESOURCES;
        }
        /**@type {number}*/ const availableSpace = creep.carryCapacity - creep.carry.energy;
        if (availableEnergy >= availableSpace) {
            return creep.withdraw(storage, RESOURCE_ENERGY, availableSpace);
        } else {
            return creep.withdraw(storage, RESOURCE_ENERGY, availableEnergy);
        }
    }
};

/**
 * Instruct a creep to refill in its current room. Does not care for cleanup when finished.
 * @param {Creep} creep Creep to refill
 * @return {?Boolean} State of refilling: true if refilling, false if full, null if room not registered or without energy to refill
 */
const refillRoutine = function (creep) {
    const roomName = creep.pos.roomName;
    if (creep.carry.energy == creep.carryCapacity) return false;
    /**@type {number}*/ let reserved;
    /**@type {StructureContainer|StructureStorage|StructureLink|Source}*/let target;
    if (memory.creeps.hasOwnProperty(creep.id)) {
        target = Game.getObjectById(memory.creeps[creep.id].target);
        reserved = memory.creeps[creep.id].reserved;
    } else {
        if (!memory.rooms.hasOwnProperty(roomName)) {
            console.log("Trying to refill in unregistered room.");
            return null;
        }
        const roomInfo = memory.rooms[roomName];
        const refillAmount = creep.carryCapacity - creep.carry.energy;
        /**@type {Array<StructureContainer|StructureStorage|StructureLink>}*/let availableStorages = [];
        for (let storageId in roomInfo.storages) {
            if (!roomInfo.storages.hasOwnProperty(storageId)) continue;
            /**@type {storageInformation}*/ let storageInfo = roomInfo.storages[storageId];
            /**@type {StructureContainer|StructureStorage|StructureLink}*/const storage = Game.getObjectById(storageId);
            if ((storage.store.energy - storageInfo.reserved) >= refillAmount
                || (storage instanceof StructureLink && (storage.energy - storageInfo.reserved) >= refillAmount)) {
                availableStorages.push(storage);
            }
        }
        target = creep.pos.findClosestByRange(availableStorages);
        /**@type{boolean}*/const harvesting = sourcesRunner.healthState(roomName) <= 1; // Enable harvesting if sources are barely harvested to containers
        if (target) {
            roomInfo.storages[target.id].reserved += refillAmount;
            memory.creeps[creep.id] = {reserved: refillAmount, target: target.id};

        } else if (!harvesting) {
            return null;
        } else {
            if (!sourceMemory.rooms.hasOwnProperty(roomName)) return null;
            /**@type {Array<Source>}*/ let availableSources = [];
            for (let sourceId in sourceMemory.rooms[roomName]) {
                if (!sourceMemory.rooms[roomName].hasOwnProperty(sourceId)) continue;
                /**@type {sourceInformation}*/ const sourceInfo = sourceMemory.rooms[roomName][sourceId];
                /**@type {Source}*/ const source = Game.getObjectById(sourceId);
                if (sourceInfo.occupation < sourceInfo.space) {
                    availableSources.push(source);
                }
            }
            target = creep.pos.findClosestByRange(availableSources);
            if (target) {
                sourceMemory.rooms[roomName][target.id].occupation++;
                memory.creeps[creep.id] = {reserved: 0, target: target.id};
            } else {
                return null;
            }
        }
        reserved = refillAmount;
    }
    if (target instanceof Source) {
        let result = creep.harvest(target);
        if (result == ERR_NOT_IN_RANGE || result == ERR_NOT_ENOUGH_RESOURCES || (result == ERR_INVALID_TARGET && creep.pos.roomName != target.pos.roomName)) {
            creep.moveTo(target);
        } else if (result != OK && result != ERR_BUSY) {
            creep.say(result);
            console.log('Refill error while harvesting: ' + creep + '\t' + target + '\t' + result);
        }
    } else {
        let result = creep.withdraw(target, RESOURCE_ENERGY, reserved);
        if (result == ERR_NOT_IN_RANGE || result == ERR_NOT_ENOUGH_RESOURCES || (result == ERR_INVALID_TARGET && creep.pos.roomName != target.pos.roomName)) {
            creep.moveTo(target);
        } else if (result != OK && result != ERR_BUSY) {
            creep.say(result);
            console.log('Refill error while withdrawing: ' + creep + '\t' + target + '\t' + result);
        }
    }
    //return creep.carry.energy < creep.carryCapacity; //Not working, because creep.carry.energy is increased in the next tick
    return true;

};

const validateMemory = function () {
    for (const roomName in memory.rooms) {
        if (!memory.rooms.hasOwnProperty(roomName)) continue;
        const roomInfo = memory.rooms[roomName];
        for (const storageId in roomInfo.storages) {
            if (!roomInfo.storages.hasOwnProperty(storageId)) continue;
            if (!Game.getObjectById(storageId)) {
                delete roomInfo.storages[storageId];
            }
        }
    }
    for (const creepId in memory.creeps) {
        if (!memory.creeps.hasOwnProperty(creepId)) continue;
        /**@type{creepInformation}*/const creepInfo = memory.creeps[creepId];
        /**@type {String}*/ const roomName = Game.getObjectById(creepInfo.target).pos.roomName;
        if (!Game.getObjectById(creepId)) {
            /**@type {roomInformation}*/ const roomInfo = memory.rooms[roomName];
            if (roomInfo.storages.hasOwnProperty(creepInfo.target)) {
                roomInfo.storages[creepInfo.target].reserved -= creepInfo.reserved;
            } else if (sourceMemory.rooms.hasOwnProperty(roomName) && sourceMemory.rooms[roomName].hasOwnProperty(creepInfo.target)) {
                sourceMemory.rooms[roomName][creepInfo.target].occupation--;
            }
            delete memory.creeps[creepId]; //Delete creepInfo if creep does not exist
        } else if (!(memory.rooms.hasOwnProperty(roomName) && memory.rooms[roomName].storages.hasOwnProperty(creepInfo.target))
            && !(sourceMemory.rooms.hasOwnProperty(roomName) && sourceMemory.rooms[roomName].hasOwnProperty(creepInfo.target))) {
            delete memory.creeps[creepId]; //Delete creepInfo if target is no registered storage or source
        }

    }
};

module.exports = energyProvider;