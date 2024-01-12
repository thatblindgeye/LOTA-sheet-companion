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
      const dieAmount = MiscScripts.getCharacterAttr(characterId, [
        {
          name: `hd_d${dieSize}`,
          parseInt: true,
        },
      ]);

      if (!isNaN(dieAmount)) {
        characterHitDice[`d${dieSize}`] = dieAmount;
      }
    });

    return characterHitDice;
  }

  /** !lotahd Script */

  function hitDieScript(argsArray, characterName, characterId) {
    const [currentHP, maxHP, maxReducedHP] = MiscScripts.getCharacterAttr(
      characterId,
      [
        { name: 'hp', parseInt: true },
        { name: 'hp', parseInt: true, value: 'max' },
        { name: 'hp_max_reduced', parseInt: true },
      ]
    );

    const trueMaxHP = maxHP - maxReducedHP;
    if (currentHP === trueMaxHP) {
      throw new Error(
        `${characterName} is already at maximum HP and does not need to expend any hit dice.`
      );
    }

    const hitDieToExpend = argsArray[0].toLowerCase();
    if (!/\d+d\d+/.test(hitDieToExpend)) {
      throw new Error(
        `<code>${hitDieToExpend}</code> is not a valid argument. The hit die to expend must be in the format <code>XdY</code>, where X is the amount of hit die to expend and Y is the size of the hit die.`
      );
    }

    const indexOfD = hitDieToExpend.indexOf('d');
    const amountToExpend = parseInt(hitDieToExpend.slice(0, indexOfD));
    const hitDieTypeToExpend = hitDieToExpend.slice(indexOfD);

    if (!amountToExpend) {
      throw new Error(
        'The amount of hit die to expend must be an integer larger than 0.'
      );
    }

    const hitDieAttrName = `hd_${hitDieTypeToExpend}`;
    const totalHitDice = getCharacterHitDice(characterId);
    const currentHitDie = totalHitDice[hitDieTypeToExpend];
    const [characterConMod] = MiscScripts.getCharacterAttr(characterId, [
      { name: 'constitution_mod', parseInt: true },
    ]);

    if (currentHitDie === undefined) {
      throw new Error(
        `${characterName} does not have any levels in a class that use ${hitDieTypeToExpend} hit dice.`
      );
    }

    const newHitDieAmount = currentHitDie - amountToExpend;
    if (newHitDieAmount < 0) {
      throw new Error(
        `Cannot expend ${amountToExpend}${hitDieTypeToExpend} hit dice. ${characterName} only has ${currentHitDie}${hitDieTypeToExpend} available to expend.`
      );
    }
    sendMessage(
      `[[${amountToExpend}${hitDieTypeToExpend}r<${
        hitDieTypeToExpend.slice(1) / 2
      } + ${amountToExpend * (characterConMod < 0 ? 0 : characterConMod)}]]`,
      (ops) => {
        const { expression: rollExpression, results } = ops[0].inlinerolls[0];
        const newHP = currentHP + parseInt(results.total);
        const trueNewHP = newHP > trueMaxHP ? trueMaxHP : newHP;

        setAttrs(characterId, {
          [hitDieAttrName]: newHitDieAmount,
          hp: trueNewHP,
        });

        const totalHitDiceKeys = Object.keys(totalHitDice);

        sendMessage(`&{template:5e-shaped} {{title=${amountToExpend}${hitDieTypeToExpend} Hit Dice for ${characterName}}} {{roll1=[[${
          results.total
        } [${rollExpression}]]]}} {{content=**New HP:** ${trueNewHP} / ${trueMaxHP}
        **Remaining Hit Dice:**
        <ul>${_.map(
          totalHitDiceKeys,
          (hitDieKey) =>
            `<li>${
              hitDieTypeToExpend === hitDieKey
                ? `${newHitDieAmount}${hitDieKey}`
                : `${totalHitDice[hitDieKey]}${hitDieKey}`
            }</li>`
        ).join('')}</ul>}}`);
      }
    );
  }

  /** !lotagunslinger Script */

  const getAmmoAttrs = (ammoId) => {
    const ammoAttrString = `repeating_ammo_${ammoId}_`;
    const ammoUsesString = `${ammoAttrString}uses`;
    const [ammoUsesName, ammoUsesValue] = MiscScripts.getCharacterAttr(
      characterId,
      [`${ammoAttrString}name`, { name: ammoUsesString, parseInt: true }]
    );

    if (isNaN(ammoUsesValue)) {
      throw new Error(
        `${ammoUsesString} is an invalid ammo ID or there is no value for the associated ID.`
      );
    }

    return {
      ammoUsesString,
      ammoUsesValue,
      ammoUsesName,
    };
  };

  function gunslingerScript(argsArray, characterName, characterId) {
    const [command, weaponId, ...args] = argsArray;
    const weaponAttrString = `repeating_offense_${weaponId}_`;
    const [weaponName, weaponUses, weaponMaxUses] =
      MiscScripts.getCharacterAttr(characterId, [
        `${weaponAttrString}name`,
        { name: `${weaponAttrString}uses`, parseInt: true },
        { name: `${weaponAttrString}uses`, parseInt: true, value: 'max' },
      ]);

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
          ammoUsesString: bulkAmmoUsesStr,
          ammoUsesValue: bulkAmmoUsesVal,
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
          ammoUsesString: weaponAmmoUsesReloadStr,
          ammoUsesValue: weaponAmmoUsesReloadVal,
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
          ammoUsesString: weaponAmmoUsesShootStr,
          ammoUsesValue: weaponAmmoUsesShootVal,
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
              const { ammoUsesValue, ammoUsesName } = getAmmoAttrs(arg);

              return `<li>${ammoUsesValue}x ${ammoUsesName}</li>`;
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
          `<code>${command}</code> is not a valid command for the lotagunslinger script. The command must be either <code>reload</code>, <code>shoot</code>, or <code>status</code>.`
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
      const [scriptName, characterId, ...commandArgs] =
        messageContent.split(' ');
      const character = getObj('character', characterId);
      const characterName = character.get('name');

      if (!character.get('controlledby').includes(playerid)) {
        throw new Error(
          `You do not control character <code>${characterName}</code>. You can only use the LOTA sheet companion commands on characters you control.`
        );
      }
      if (!commandArgs.length) {
        throw new Error(
          `No arguments were passed to the <code>${scriptName}</code> script.`
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
