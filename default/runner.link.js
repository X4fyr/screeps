/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('runner.link');
 * mod.thing == 'a thing'; // true
 */

/**
 * @typedef {{upperLimit: number, link: String, overflowLink: String, lowerLimit: number, refillLink: String}} linkInformation
 * @type {{rooms:Object<String, Array<linkInformation>>}}
 */
let memory = {};

const linkRunner = {
    init: function () {
        memory = Memory.runner.link;
        if (!memory.rooms) {
            memory.rooms = {};
        }
    },
    run: function () {
        for (let roomName in Game.rooms) {
            if (!Game.rooms.hasOwnProperty(roomName)) continue;
            if (memory.rooms[roomName]) {
                for (let idx in memory.rooms[roomName]) {
                    if (!memory.rooms[roomName].hasOwnProperty(idx)) continue;
                    const task = memory.rooms[roomName][idx]; //task = {link, upperLimit, overflowLink, lowerLimit, refillLink}
                    const link = Game.getObjectById(task.link);
                    if (link) {
                        if (link.energy > task.upperLimit) {
                            const overflowLink = Game.getObjectById(task.overflowLink);
                            if (overflowLink) {
                                if (overflowLink.energyCapacity - overflowLink.energy > link.energy - task.lowerLimit) {
                                    link.transferEnergy(overflowLink, link.energy - task.lowerLimit);
                                } else {
                                    link.transferEnergy(overflowLink, overflowLink.energyCapacity - overflowLink.energy);
                                }
                            }
                        } else if (link.energy < task.lowerLimit) {
                            const refillLink = Game.getObjectById(task.refillLink);
                            if (refillLink && refillLink.energy > 0) {
                                if (refillLink.energy > task.lowerLimit - link.energy) {
                                    refillLink.transferEnergy(link, task.lowerLimit - link.energy);
                                } else {
                                    refillLink.transferEnergy(link, refillLink.energy);
                                }
                            }
                        }
                    }
                }
            }
        }
        Memory.runner.link = memory;
    }
};

module.exports = linkRunner;