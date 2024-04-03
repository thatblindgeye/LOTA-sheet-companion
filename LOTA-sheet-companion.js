/**
 * LOTA sheet companion
 *
 * Version 1.0
 * Last updated: March 3, 2024
 * Author: thatblindgeye
 * GitHub: https://github.com/thatblindgeye
 *
 * Syntax: !scriptName characterId commandArgs
 *
 */

const LOTASheetCompanion = (function () {
  'use strict';

  const LOTASC_DISPLAY_NAME = 'LOTA-SC';
  const DIE_SIZES = [4, 6, 8, 10, 12, 20];

  function sendMessage(
    messageDetailsObject,
    messageCallback = null,
    noarchive = true
  ) {
    sendChat(
      messageDetailsObject.sendAs || LOTASC_DISPLAY_NAME,
      messageDetailsObject.messageToSend,
      messageCallback,
      {
        noarchive,
      }
    );
  }

  function getClassLevels(characterId, classLevelsToGet) {
    const [classLevels] = MiscScripts.getCharacterAttr(characterId, [
      `class_and_level`,
    ]);

    if (typeof classLevelsToGet === 'string') {
      const classRegex = new RegExp(`${classLevelsToGet} (\\d+)`, 'i');
      return parseInt(classLevels.match(classRegex)?.[1]);
    }

    return classLevelsToGet.map((className) => {
      const classRegex = new RegExp(`${className} (\\d+)`, 'i');
      return parseInt(classLevels.match(classRegex)?.[1]);
    });
  }

  function updateRepeatingUses(
    repeatingItemObject,
    characterName,
    characterId
  ) {
    const {
      repeatingItemId,
      repeatingItemUses,
      repeatingItemMax,
      repeatingItemName,
      changeAmount,
    } = repeatingItemObject;

    if (isNaN(changeAmount) || changeAmount === 0) {
      throw new Error(
        `<code>${amount}</code> is not a valid amount to expend. The amount must be a positive or negative integer, and cannot be 0.`
      );
    }
    if (repeatingItemUses === 0 && changeAmount < 0) {
      throw new Error(
        `${characterName} does not have any uses of ${repeatingItemName} to expend.`
      );
    }
    if (
      changeAmount > 0 &&
      repeatingItemUses + changeAmount > repeatingItemMax
    ) {
      throw new Error(
        `Cannot replenish ${changeAmount} use(s) of ${repeatingItemName} as it would exceed the maximum amount of ${repeatingItemMax}.`
      );
    }
    if (changeAmount < 0 && repeatingItemUses + changeAmount < 0) {
      throw new Error(
        `Cannot expend ${changeAmount} use(s) of ${repeatingItemName} as ${characterName} only has ${repeatingItemUses} use(s) available.`
      );
    }

    setAttrs(characterId, {
      [`${repeatingItemId}uses`]: repeatingItemUses + changeAmount,
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

  // TODO: Update to allow physical roll input
  function expendHitDie(argsArray, characterName, characterId) {
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
      {
        messageToSend: `[[${amountToExpend}${hitDieTypeToExpend}r<${
          hitDieTypeToExpend.slice(1) / 2
        } + ${amountToExpend * (characterConMod < 0 ? 0 : characterConMod)}]]`,
      },
      (ops) => {
        const { expression: rollExpression, results } = ops[0].inlinerolls[0];
        const newHP = currentHP + parseInt(results.total);
        const trueNewHP = newHP > trueMaxHP ? trueMaxHP : newHP;

        setAttrs(characterId, {
          [hitDieAttrName]: newHitDieAmount,
          hp: trueNewHP,
        });

        const totalHitDiceKeys = Object.keys(totalHitDice);

        sendMessage({
          messageToSend: `&{template:5e-shaped} {{title=${amountToExpend}${hitDieTypeToExpend} Hit Dice for ${characterName}}} {{roll1=[[${
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
        ).join('')}</ul>}}`,
        });
      }
    );
  }

  const getAmmoAttrs = (ammoId, characterId) => {
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

  function gunslingerHandleAmmo(argsArray, characterName, characterId) {
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
        } = getAmmoAttrs(args[1], characterId);
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
        } = args[2] ? getAmmoAttrs(args[2], characterId) : {};
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
        sendMessage({
          messageToSend: `/w "${characterName}" ${characterName} ${
            isPositiveAmount
              ? `reloaded ${amountToReload} ${bulkAmmoUsesName} into`
              : `unloaded ${amountToReload * -1} ${bulkAmmoUsesName} from`
          } the ${weaponName}`,
        });
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
        } = args[1] ? getAmmoAttrs(args[1], characterId) : {};

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
              const { ammoUsesValue, ammoUsesName } = getAmmoAttrs(
                arg,
                characterId
              );

              return `<li>${ammoUsesValue}x ${ammoUsesName}</li>`;
            })
          : [];
        const weaponAmmoStatusString = weaponAmmoStatusArray.length
          ? `{{content=<ul>${weaponAmmoStatusArray.join('')}</ul>}}`
          : '';

        sendMessage({
          messageToSend: `/w "${characterName}" &{template:5e-shaped} {{title=${weaponName} - ${characterName} (${weaponUses} / ${weaponMaxUses})}} ${weaponAmmoStatusString}`,
        });
        break;
      default:
        throw new Error(
          `<code>${command}</code> is not a valid command for the lotagunslinger script. The command must be either <code>reload</code>, <code>shoot</code>, or <code>status</code>.`
        );
    }
  }

  function gunslingerUseTrick(commandArgs, characterName, characterId) {
    const gunslingerLevel = getClassLevels(characterId, 'gunslinger');

    if (!gunslingerLevel) {
      throw new Error(
        `${characterName} does not have any levels in the Gunslinger class.`
      );
    }
    if (gunslingerLevel && gunslingerLevel < 3) {
      throw new Error(
        `${characterName} must have at least 3 levels in the Gunslinger class to use tricks.`
      );
    }

    const [superiorityDieItemId, trickFeatureItemId] = commandArgs;
    const trickFeatureRepRowId = `repeating_classfeature_${trickFeatureItemId}_`;
    const [trickFeatureUses, trickFeatureMax, trickFeatureName] =
      MiscScripts.getCharacterAttr(characterId, [
        { name: `${trickFeatureRepRowId}uses`, parseInt: true },
        { name: `${trickFeatureRepRowId}uses`, parseInt: true, value: 'max' },
        `${trickFeatureRepRowId}name`,
      ]);

    if (!_.isNaN(trickFeatureUses) && !_.isNaN(trickFeatureMax)) {
      const trickFeatureObject = {
        repeatingItemId: trickFeatureRepRowId,
        repeatingItemUses: trickFeatureUses,
        repeatingItemMax: trickFeatureMax,
        repeatingItemName: trickFeatureName,
        changeAmount: -1,
      };

      updateRepeatingUses(trickFeatureObject, characterName, characterId);
    }

    const superiorityDieRepRowId = `repeating_utility_${superiorityDieItemId}_`;
    const [superiorityDieUses, superiorityDieMax, superiorityDieName] =
      MiscScripts.getCharacterAttr(characterId, [
        { name: `${superiorityDieRepRowId}uses`, parseInt: true },
        { name: `${superiorityDieRepRowId}uses`, parseInt: true, value: 'max' },
        `${superiorityDieRepRowId}name`,
      ]);
    const superiorityDieObject = {
      repeatingItemId: superiorityDieRepRowId,
      repeatingItemUses: superiorityDieUses,
      repeatingItemMax: superiorityDieMax,
      repeatingItemName: superiorityDieName,
      changeAmount: -1,
    };
    updateRepeatingUses(superiorityDieObject, characterName, characterId);

    const superiorityDieSize =
      gunslingerLevel > 16 ? 'd12' : gunslingerLevel > 8 ? 'd10' : 'd8';

    sendMessage({
      messageToSend: `/w "${characterName}" &{template:5e-shaped} {{title=${characterName} | ${trickFeatureName}}} {{content=**Result:** [[1${superiorityDieSize}]]\n**Superiority Dice Remaining:** ${
        superiorityDieUses - 1
      }}}`,
    });
  }

  function benderPerformTechnique(commandArgs, characterName, characterId) {
    const [benderLevel, avatarLevel] = getClassLevels(characterId, [
      'bender',
      'avatar',
    ]);

    if ([benderLevel, avatarLevel].every((level) => _.isNaN(level))) {
      throw new Error(
        `${characterName} must have at least 1 level in a bender class in order to perform techniques.`
      );
    }

    const [techniqueId, enhancedArg] = commandArgs;
    const isEnhanced = enhancedArg.toLowerCase() === 'true';

    const techniqueRepRowId = `repeating_${techniqueId}_`;
    const techniqueLevel = parseInt(techniqueId.match(/^spell(\d)/)[1]);
    const [chiPointsCurrent, baseTechniqueCost, techniqueName] =
      MiscScripts.getCharacterAttr(characterId, [
        { name: `spell_points`, parseInt: true },
        {
          name: `spell_level_${techniqueLevel}_cost`,
          parseInt: true,
        },
        { name: `${techniqueRepRowId}name` },
      ]);

    // Cantrips have no point cost, so a fallback of 0 is needed
    const adjustedBaseCost = baseTechniqueCost || 0;
    const totalChiCost = isEnhanced ? adjustedBaseCost + 2 : adjustedBaseCost;
    const newTotalChiPoints = chiPointsCurrent - totalChiCost;

    if (newTotalChiPoints < 0 && benderLevel >= 7) {
      // TODO: Insert logic for Push It feature here?
    }

    if (newTotalChiPoints < 0) {
      throw new Error(
        `${characterName} cannot perform the ${techniqueName} technique ${
          isEnhanced ? 'with its enhanced effect' : ''
        } as it would cost ${totalChiCost} chi points, and ${characterName} only has ${chiPointsCurrent} available.`
      );
    }

    const areChiPointsChanged = newTotalChiPoints !== chiPointsCurrent;
    if (areChiPointsChanged) {
      setAttrs(characterId, {
        [`spell_points`]: chiPointsCurrent - totalChiCost,
      });
    }
    sendMessage({
      sendAs: characterName,
      messageToSend: `/em performed the ${techniqueName} technique${
        areChiPointsChanged
          ? `, and has ${newTotalChiPoints} chi points remaining`
          : ''
      }!`,
    });
  }

  function benderUseSpecialization(commandArgs, characterName, characterId) {
    const [specializationId, chiCost] = commandArgs;
    const parsedChiCost = parseInt(chiCost);
    const specializationRepRowId = `repeating_spell4_${specializationId}_`;
    const [specializationUses, specializationName, chiPointsCurrent] =
      MiscScripts.getCharacterAttr(characterId, [
        { name: `${specializationRepRowId}uses`, parseInt: true },
        { name: `${specializationRepRowId}name` },
        { name: `spell_points`, parseInt: true },
      ]);

    if (
      !specializationUses &&
      (!chiPointsCurrent || chiPointsCurrent - parsedChiCost < 0)
    ) {
      throw new Error(
        `${characterName} cannot use the ${specializationName} specialization as they have no remaining uses of it, and only have ${chiPointsCurrent} chi points (requires ${chiCost}).`
      );
    }

    const attrToUpdate = !specializationUses
      ? 'spell_points'
      : `${specializationRepRowId}uses`;
    const newAttrValue = !specializationUses
      ? chiPointsCurrent - parsedChiCost
      : specializationUses - 1;

    setAttrs(characterId, {
      [attrToUpdate]: newAttrValue,
    });
    sendMessage({
      sendAs: characterName,
      messageToSend: `/em used the ${specializationName} specialization, and has ${newAttrValue} ${
        !specializationUses
          ? 'chi points remaining!'
          : 'uses remaining (must expend chi points on subsequent uses)!'
      }`,
    });
  }

  function benderChiRecovery(commandArgs, characterName, characterId) {
    const [chiRecoveryId] = commandArgs;
    const chiRecoveryRepId = `repeating_classfeature_${chiRecoveryId}_`;

    const [chiRecoveryUses, chiPointsCurrent, chiPointsMax, proficiencyBonus] =
      MiscScripts.getCharacterAttr(characterId, [
        { name: `${chiRecoveryRepId}uses`, parseInt: true },
        { name: `spell_points`, parseInt: true },
        { name: `spell_points`, parseInt: true, value: 'max' },
        { name: `pb`, parseInt: true },
      ]);

    if (!chiRecoveryUses) {
      throw new Error(
        `${characterName} has no more uses of their Chi Recovery feature.`
      );
    }
    if (chiPointsCurrent === chiPointsMax) {
      throw new Error(
        `${characterName} is already at max chi points and cannot recover any more.`
      );
    }

    const newTotalChiPoints = Math.min(
      chiPointsMax,
      chiPointsCurrent + proficiencyBonus
    );
    setAttrs(characterId, {
      ['spell_points']: newTotalChiPoints,
      [`${chiRecoveryRepId}uses`]: chiRecoveryUses - 1,
    });
    sendMessage({
      sendAs: characterName,
      messageToSend: `/em used their Chi Recovery and now has ${newTotalChiPoints}/${chiPointsMax} chi points!`,
    });
  }

  function handleChatInput(message) {
    if (
      message.type !== 'api' ||
      !/^!lota(gunslinger|hd|bender)?/i.test(message.content)
    ) {
      return;
    }

    try {
      const { content: messageContent, playerid } = message;
      const [scriptName, ...commandArgs] = messageContent.split(' ');
      const [characterId, ...restArgs] = commandArgs;
      const character = getObj('character', characterId);
      const characterName = character.get('name');

      if (!character.get('controlledby').includes(playerid)) {
        throw new Error(
          `You do not control character <code>${characterName}</code>. You can only use the LOTA sheet companion commands on characters you control.`
        );
      }
      if (!restArgs.length) {
        throw new Error(
          `No arguments were passed to the <code>${scriptName}</code> script.`
        );
      }

      switch (scriptName.toLowerCase()) {
        case '!lotahd':
          expendHitDie(restArgs, characterName, character.id);
          break;
        case '!lotagunslingerammo':
          gunslingerHandleAmmo(restArgs, characterName, character.id);
          break;
        case '!lotagunslingertricks':
          gunslingerUseTrick(restArgs, characterName, character.id);
          break;
        case '!lotabendertechnique':
          benderPerformTechnique(restArgs, characterName, character.id);
          break;
        case '!lotabenderspecialization':
          benderUseSpecialization(restArgs, characterName, character.id);
          break;
        case '!lotabenderchirecovery':
          benderChiRecovery(restArgs, characterName, character.id);
          break;
      }
    } catch (error) {
      sendMessage({
        messageToSend: `/w "${message.who.replace(' (GM)', '')}" ${
          error.message
        }`,
      });
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
