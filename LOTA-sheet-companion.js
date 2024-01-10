/**
 * LOTA sheet companion
 *
 * Version 1.0
 * Last updated: January 9, 2024
 * Author: thatblindgeye
 * GitHub: https://github.com/thatblindgeye
 *
 */

const LOTASheetCompanion = (function () {
  'use strict';

  const LOTASC_DISPLAY_NAME = 'LOTA-SC';

  const DIE_SIZES = [4, 6, 8, 10, 12, 20];

  function sendMessage(
    messageToSend,
    messageCallback = null,
    noarchive = true
  ) {
    sendChat(LOTASC_DISPLAY_NAME, messageToSend, messageCallback, {
      noarchive,
    });
  }

  function getCharacterHitDice(characterId) {
    const characterHitDice = {};
    _.each(DIE_SIZES, (dieSize) => {
      characterHitDice[`d${dieSize}`] = getCharacterAttr(characterId, {
        name: `he_d${dieSize}`,
        parseInt: true,
      });
    });

    return characterHitDice;
  }

  /** !lotahd Script */

  function hitDieScript(argsArray, characterName, characterId) {
    const [hitDieToExpend] = argsArray;

    const [currentHP, maxHP, maxReducedHP] = MiscScripts.getCharacterAttr(
      characterId,
      [
        { name: 'hp', parseInt: true },
        { name: 'hp', parseInt: true, value: 'max' },
        { name: 'hp_max_reduced', parseInt: true },
      ]
    );

    if (currentHP === maxHP) {
      throw new Error(
        `${characterName} is already at maximum HP and does not need to expend any hit dice.`
      );
    }

    const [hitDieAmount, hitDieType] = _.map(
      hitDieToExpend.split('d'),
      (hitDieItem) => parseInt(hitDieItem)
    );

    if (!hitDieAmount) {
      throw new Error(
        'The amount of hit die to expend must be an integer larger than 0.'
      );
    }

    const hitDieAttrName = `hd_d${hitDieType}`;
    const [characterConMod, currentHitDie] = MiscScripts.getCharacterAttr(
      characterId,
      [
        { name: 'constitution_mod', parseInt: true },
        { name: hitDieAttrName, parseInt: true },
      ]
    );
    if (isNaN(currentHitDie)) {
      throw new Error(
        `${characterName} does not have any levels in a class that use d${hitDieType} hit dice.`
      );
    }

    const newHitDieAmount = currentHitDie - hitDieAmount;
    if (newHitDieAmount < 0) {
      throw new Error(
        `Cannot expend ${hitDieAmount}d${hitDieType} hit dice. ${characterName} only has ${currentHitDie}d${hitDieType} available to expend.`
      );
    }
    sendMessage(
      `[[${hitDieAmount}d${hitDieType}r<${hitDieType / 2} + ${
        hitDieAmount * (characterConMod < 0 ? 0 : characterConMod)
      }]]`,
      (ops) => {
        const { expression: rollExpression, results } = ops[0].inlinerolls[0];
        const trueMaxHP = maxHP - maxReducedHP;
        const newHP = currentHP + parseInt(results.total);
        const trueNewHP = newHP > trueMaxHP ? trueMaxHP : newHP;

        setAttrs(characterId, {
          [hitDieAttrName]: currentHitDie - hitDieAmount,
          hp: trueNewHP,
        });

        sendMessage(`&{template:5e-shaped} {{title=${hitDieAmount}d${hitDieType} Hit Dice for ${characterName}}} {{roll1=[[${results.total} [${rollExpression}]]]}} {{content=**New HP:** ${trueNewHP} / ${trueMaxHP}
            
        ${newHitDieAmount}d${hitDieType} hit die remaining}}`);
      }
    );
  }

  /** !lotagunslinger Script */

  function gunslingerScript(argsArray, characterName, characterId) {
    const [command, weaponId, ...args] = argsArray;
    const weaponAttrString = `repeating_offense_${weaponId}_`;
    const [weaponName, weaponUses, weaponMaxUses] =
      MiscScripts.getCharacterAttr(characterId, [
        `${weaponAttrString}name`,
        { name: `${weaponAttrString}uses`, parseInt: true },
        { name: `${weaponAttrString}uses`, parseInt: true, value: 'max' },
      ]);
    const getAmmoAttrs = (ammoId) => {
      const ammoAttrString = `repeating_ammo_${ammoId}_`;
      const ammoUsesStr = `${ammoAttrString}uses`;
      const [ammoUsesName, ammoUsesVal] = MiscScripts.getCharacterAttr(
        characterId,
        [`${ammoAttrString}name`, { name: ammoUsesStr, parseInt: true }]
      );

      if (isNaN(ammoUsesVal)) {
        throw new Error(`${ammoUsesStr} is an invalid ammo ID.`);
      }

      return {
        ammoUsesStr,
        ammoUsesVal,
        ammoUsesName,
      };
    };

    const attrsToSet = {};
    switch (command) {
      case 'load':
        const amountToReload = parseInt(args[0]);
        if (isNaN(amountToReload) || amountToReload === 0) {
          throw new Error(
            `The amount to reload must be an integer greater than 0, or the amount to unload must be an integer less than 0.`
          );
        }

        const isPositiveAmount = amountToReload > 0;
        if (weaponUses === weaponMaxUses && isPositiveAmount) {
          throw new Error(
            `${weaponName} is fully loaded and cannot be reloaded any further.`
          );
        }
        if (weaponUses === 0 && !isPositiveAmount) {
          throw new Error(
            `${weaponName} is empty and cannot be unloaded any further.`
          );
        }
        if (isPositiveAmount && weaponUses + amountToReload > weaponMaxUses) {
          throw new Error(
            `Cannot reload ${amountToReload} ammunition. The ${weaponName} is currently loaded with ${weaponUses} ammunition and has a maximum capacity of ${weaponMaxUses}.`
          );
        }
        if (!isPositiveAmount && weaponUses + amountToReload < 0) {
          throw new Error(
            `Cannot unload ${
              amountToReload * -1
            } ammunition. The ${weaponName} is currently loaded with ${weaponUses} ammunition and cannot be unloaded to less than 0 ammunition.`
          );
        }

        const {
          ammoUsesStr: bulkAmmoUsesStr,
          ammoUsesVal: bulkAmmoUsesVal,
          ammoUsesName: bulkAmmoUsesName,
        } = getAmmoAttrs(args[1]);
        if (isPositiveAmount && bulkAmmoUsesVal < amountToReload) {
          throw new Error(
            `Unable to reload ${amountToReload} ${bulkAmmoUsesName} as there are only ${bulkAmmoUsesVal} available.`
          );
        }
        attrsToSet[`${weaponAttrString}uses`] = weaponUses + amountToReload;
        attrsToSet[bulkAmmoUsesStr] = bulkAmmoUsesVal - amountToReload;

        const {
          ammoUsesStr: weaponAmmoUsesReloadStr,
          ammoUsesVal: weaponAmmoUsesReloadVal,
          ammoUsesName: weaponAmmoUsesReloadName,
        } = args[2] ? getAmmoAttrs(args[2]) : {};
        if (!isPositiveAmount && weaponAmmoUsesReloadVal === 0) {
          throw new Error(
            `Unable to unload ${
              amountToReload * -1
            } ${weaponAmmoUsesReloadName} as there are currently none loaded.`
          );
        }
        if (weaponAmmoUsesReloadVal !== undefined) {
          attrsToSet[weaponAmmoUsesReloadStr] =
            weaponAmmoUsesReloadVal + amountToReload;
        }

        setAttrs(characterId, attrsToSet);
        sendMessage(
          `/w "${characterName}" ${characterName} ${
            isPositiveAmount
              ? `reloaded ${amountToReload} ${bulkAmmoUsesName} into`
              : `unloaded ${amountToReload * -1} ${bulkAmmoUsesName} from`
          } the ${weaponName}`
        );
        break;

      case 'shoot':
        const amountToShoot = parseInt(args[0]);

        if (isNaN(amountToShoot) || amountToShoot < 1) {
          throw new Error(
            `The amount of ammunition to shoot must be an integer greater than 0.`
          );
        }
        attrsToSet[`${weaponAttrString}uses`] = weaponUses - amountToShoot;

        const {
          ammoUsesStr: weaponAmmoUsesShootStr,
          ammoUsesVal: weaponAmmoUsesShootVal,
          ammoUsesName: weaponAmmoUsesShootName,
        } = args[1] ? getAmmoAttrs(args[1]) : {};

        if (amountToShoot > weaponAmmoUsesShootVal) {
          throw new Error(
            `Cannot shoot ${amountToShoot} ${weaponAmmoUsesShootName}. ${weaponName} only has ${weaponAmmoUsesShootVal} loaded.`
          );
        }
        if (weaponAmmoUsesShootVal !== undefined) {
          attrsToSet[weaponAmmoUsesShootStr] =
            weaponAmmoUsesShootVal - amountToShoot;
        }

        setAttrs(characterId, attrsToSet);
        break;
      case 'status':
        const weaponAmmoStatusArray = args.length
          ? _.map(args, (arg) => {
              const { ammoUsesVal, ammoUsesName } = getAmmoAttrs(arg);

              return `<li>${ammoUsesVal}x ${ammoUsesName}</li>`;
            })
          : [];
        const weaponAmmoStatusString = weaponAmmoStatusArray.length
          ? `{{content=<ul>${weaponAmmoStatusArray.join('')}</ul>}}`
          : '';

        sendMessage(
          `/w "${characterName}" &{template:5e-shaped} {{title=${weaponName} - ${characterName} (${weaponUses} / ${weaponMaxUses})}} ${weaponAmmoStatusString}`
        );
        break;
      default:
        throw new Error(
          `${command} is not a valid command for the lotagunslinger script. The command must be either reload, shoot, or status.`
        );
    }
  }

  function handleChatInput(message) {
    if (
      message.type !== 'api' ||
      !/^!lota(gunslinger|hd)?/i.test(message.content)
    ) {
      return;
    }

    try {
      const { content: messageContent, playerid } = message;
      const [, characterId, ...commandArgs] = messageContent.split(' ');
      const character = getObj('character', characterId);
      const characterName = character.get('name');

      if (!character.get('controlledby').includes(playerid)) {
        throw new Error(
          `You do not control character <code>${characterName}</code>. You can only use the LOTA sheet companion commands on characters you control.`
        );
      }

      if (/^!lotahd/i.test(messageContent)) {
        hitDieScript(commandArgs, characterName, character.id);
      }

      if (/^!lotagunslinger/i.test(messageContent)) {
        gunslingerScript(commandArgs, characterName, character.id);
      }
    } catch (error) {
      sendMessage(`/w "${message.who.replace(' (GM)', '')}" ${error.message}`);
    }
  }

  function registerEventHandlers() {
    on('chat:message', handleChatInput);
  }

  return {
    registerEventHandlers,
  };
})();

on('ready', () => {
  'use strict';

  LOTASheetCompanion.registerEventHandlers();
});
