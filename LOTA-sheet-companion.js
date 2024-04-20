/**
 * LOTA sheet companion
 *
 * Version 1.0
 * Last updated: March 6, 2024
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

  function styleInlineRolls(roll, critSuccessThreshold, critFailThreshold) {
    const rollWrapper = _.template(
      `<span style="border: 3px solid <%= borderColor %>; display: inline-block; padding: 4px 2px; margin-bottom: 4px;">${roll.expression}</span>`
    );

    if (roll.result >= critSuccessThreshold) {
      return rollWrapper({ borderColor: 'green' });
    }
    if (roll.result <= critFailThreshold) {
      return rollWrapper({ borderColor: 'red' });
    }

    return rollWrapper({ borderColor: 'transparent' });
  }

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

    const totalHitDiceKeys = Object.keys(totalHitDice);
    const createMessageContent = (
      roll1Content,
      newHPAmount
    ) => `&{template:5e-shaped} {{title=${amountToExpend}${hitDieTypeToExpend} Hit Dice for ${characterName}}} {{roll1=${roll1Content}}} {{content=**New HP:** ${newHPAmount} / ${trueMaxHP}
    **Remaining Hit Dice:**
    <ul>${_.map(
      totalHitDiceKeys,
      (hitDieKey) =>
        `<li>${
          hitDieTypeToExpend === hitDieKey
            ? `${newHitDieAmount}${hitDieKey}`
            : `${totalHitDice[hitDieKey]}${hitDieKey}`
        }</li>`
    ).join('')}</ul>}}`;

    const attrsToSet = { [hitDieAttrName]: newHitDieAmount };
    const physicalRollAmount = parseInt(argsArray[1]);
    if (!_.isNaN(physicalRollAmount)) {
      const newHpFromPhysicalRoll = Math.min(
        currentHP + physicalRollAmount,
        trueMaxHP
      );

      setAttrs(characterId, {
        ...attrsToSet,
        hp: newHpFromPhysicalRoll,
      });

      sendMessage({
        messageToSend: createMessageContent(
          `[[${physicalRollAmount}]]`,
          newHpFromPhysicalRoll
        ),
      });
      return;
    }

    const [characterConMod] = MiscScripts.getCharacterAttr(characterId, [
      { name: 'constitution_mod', parseInt: true },
    ]);
    sendMessage(
      {
        messageToSend: `[[${amountToExpend}${hitDieTypeToExpend}r<${
          hitDieTypeToExpend.slice(1) / 2
        } + ${amountToExpend * (characterConMod < 0 ? 0 : characterConMod)}]]`,
      },
      (ops) => {
        const { expression: rollExpression, results } = ops[0].inlinerolls[0];
        const newHpFromChat = Math.min(
          currentHP + parseInt(results.total),
          trueMaxHP
        );

        setAttrs(characterId, {
          ...attrsToSet,
          hp: newHpFromChat,
        });

        sendMessage({
          messageToSend: createMessageContent(
            `[[${results.total} [${rollExpression}]]]`,
            newHpFromChat
          ),
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

  function gunslingerAmmoStatus(characterId, weaponInfo, ammoIds) {
    let weaponName = '';
    let weaponUses = '';
    let weaponMaxUses = '';

    if (typeof weaponInfo === 'string') {
      const weaponAttrString = `repeating_offense_${weaponInfo}_`;
      [weaponName, weaponUses, weaponMaxUses] = MiscScripts.getCharacterAttr(
        characterId,
        [
          `${weaponAttrString}name`,
          { name: `${weaponAttrString}uses`, parseInt: true },
          { name: `${weaponAttrString}uses`, parseInt: true, value: 'max' },
        ]
      );
    } else {
      const { name, uses, maxUses } = weaponInfo;
      weaponName = name;
      weaponUses = uses;
      weaponMaxUses = maxUses;
    }
    const weaponAmmoStatusArray = ammoIds.length
      ? _.map(ammoIds, (ammoId) => {
          const { ammoUsesValue, ammoUsesName } = getAmmoAttrs(
            ammoId,
            characterId
          );

          return `<li>${ammoUsesValue}x ${ammoUsesName}</li>`;
        })
      : [];
    const weaponAmmoStatusList = weaponAmmoStatusArray.length
      ? `<ul>${weaponAmmoStatusArray.join('')}</ul>`
      : '';

    return {
      title: `${weaponName} (${weaponUses} / ${weaponMaxUses}`,
      content: weaponAmmoStatusList,
    };
  }

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
        if (weaponUses - amountToShoot < 0) {
          throw new Error(
            `Cannot shoot ${amountToShoot} ammo as ${weaponName} only has ${weaponUses} ammo loaded.`
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
        const ammoStatusInfo = gunslingerAmmoStatus(
          characterId,
          { name: weaponName, uses: weaponUses, maxUses: weaponMaxUses },
          args
        );

        sendMessage({
          messageToSend: `/w "${characterName}" &{template:5e-shaped} {{title=${characterName} - ${ammoStatusInfo.title})}} {{content=${ammoStatusInfo.content}}}`,
        });
        break;
      default:
        throw new Error(
          `<code>${command}</code> is not a valid command for the lotagunslinger script. The command must be either <code>reload</code>, <code>shoot</code>, or <code>status</code>.`
        );
    }
  }

  const GUNSLINGER_ATTACK_TYPES = {
    normal: 'normalshot',
    analytical: 'analyticalshot',
    stockStrike: 'stockstrike',
  };
  function gunslingerHandleFirearmAttack(
    argsArray,
    characterName,
    characterId
  ) {
    const [weaponId, attackType, misfireThreshold, amountToShoot, ...ammoIds] =
      argsArray;
    const lowercasedAttackType = attackType.toLowerCase();
    if (
      !Object.values(GUNSLINGER_ATTACK_TYPES).includes(lowercasedAttackType)
    ) {
      throw new Error(
        `<code>${attackType}</code> is not a valid attack type. The attack type must be one of either <code>normalshot</code>, <code>analyticalshot</code>, or <code>stockstrike</code>.`
      );
    }
    const isShootAttack = [
      GUNSLINGER_ATTACK_TYPES.normal,
      GUNSLINGER_ATTACK_TYPES.analytical,
    ].includes(lowercasedAttackType);

    if (isShootAttack) {
      gunslingerHandleAmmo(
        ['shoot', weaponId, amountToShoot, ...ammoIds],
        characterName,
        characterId
      );
    }
    const weaponAttrString = `repeating_offense_${weaponId}_`;
    const isAnalyticalShot =
      isShootAttack &&
      lowercasedAttackType === GUNSLINGER_ATTACK_TYPES.analytical;
    const abilityModifierAttribute = isAnalyticalShot
      ? 'intelligence_mod'
      : 'dexterity_mod';
    const [
      weaponName,
      weaponRange,
      weaponDamageDice,
      weaponDamageDieSize,
      proficiencyBonus,
      abilityModifier,
    ] = MiscScripts.getCharacterAttr(characterId, [
      `${weaponAttrString}name`,
      `${weaponAttrString}range`,
      { name: `${weaponAttrString}attack_damage_dice`, parseInt: true },
      `${weaponAttrString}attack_damage_die`,
      { name: `pb`, parseInt: true },
      { name: abilityModifierAttribute, parseInt: true },
    ]);
    const gunslingerLevel = getClassLevels(characterId, 'gunslinger');
    const firearmAttacksPerTurn =
      gunslingerLevel === 20 ? 3 : gunslingerLevel >= 5 ? 2 : 1;

    sendMessage(
      {
        messageToSend: `[[2d20]]`,
      },
      (ops) => {
        const { results } = ops[0].inlinerolls[0];
        const abilityModifierExpression = `${abilityModifier} [${
          isAnalyticalShot ? 'Int' : 'Dex'
        }]`;
        const rollExpressions = _.map(results.rolls[0].results, (result) => {
          const expression = `[[${result.v} [1d20] + ${proficiencyBonus} [prof] + ${abilityModifierExpression}]]`;

          return styleInlineRolls(
            { result: result.v, expression },
            20,
            parseInt(misfireThreshold) || 1
          );
        });
        const damageExpression = isShootAttack
          ? `[[${weaponDamageDice}${weaponDamageDieSize} + ${abilityModifierExpression} + 2 [Gun Duelist]]] piercing (metal round) or bludgeoning (rubber round)`
          : `[[1 + ${abilityModifierExpression} + 2 [Gun Duelist]]] bludgeoning`;
        const critDamageInfo = `\n**Damage on crit:** +${
          isShootAttack ? weaponDamageDieSize.replace('d', '') : '1'
        }`;
        const ammoStatusInfo = isShootAttack
          ? gunslingerAmmoStatus(characterId, weaponId, ammoIds)
          : undefined;

        sendMessage({
          messageToSend: `&{template:5e-shaped} {{title=${characterName} - ${weaponName} (${
            isAnalyticalShot
              ? 'Analytical Shot'
              : isShootAttack
              ? 'Normal Shot'
              : 'Stock Strike'
          })<div style="font-size: 0.9rem;"><div>Range: ${
            isShootAttack ? weaponRange : '5'
          } ft</div><div>${firearmAttacksPerTurn} firearm attacks per turn</div></div>}} {{roll1=**Normal:** ${
            rollExpressions[0]
          }}} {{roll2=**(Dis)Advantage:** ${
            rollExpressions[1]
          }}} {{content=<div style="margin-top: 4px;">**Damage:** ${damageExpression} ${critDamageInfo} ${
            ammoStatusInfo
              ? `<div style="margin-top: 6px;">**Remaining Ammo:**${ammoStatusInfo.content}</div>`
              : ''
          }</div>}}`,
        });
      }
    );
  }

  function gunslingerUseSuperiorityDie(
    commandArgs,
    characterName,
    characterId
  ) {
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

    const [superiorityDieItemId, classFeatureId] = commandArgs;
    const classFeatureRepRowId = `repeating_classfeature_${classFeatureId}_`;
    const [classFeatureUses, classFeatureMax, classFeatureName] =
      MiscScripts.getCharacterAttr(characterId, [
        { name: `${classFeatureRepRowId}uses`, parseInt: true },
        { name: `${classFeatureRepRowId}uses`, parseInt: true, value: 'max' },
        `${classFeatureRepRowId}name`,
      ]);

    if (!_.isNaN(classFeatureUses) && !_.isNaN(classFeatureMax)) {
      const trickFeatureObject = {
        repeatingItemId: classFeatureRepRowId,
        repeatingItemUses: classFeatureUses,
        repeatingItemMax: classFeatureMax,
        repeatingItemName: classFeatureName,
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
    const rollResult = `[[1${superiorityDieSize}${
      /fast (and|&) low/i.test(classFeatureName) ? ' * 5]] feet' : ']]'
    }`;

    sendMessage({
      messageToSend: `/w "${characterName}" &{template:5e-shaped} {{title=${characterName} | ${classFeatureName}}} {{content=**Result:** ${rollResult}\n**Superiority Dice Remaining:** ${
        superiorityDieUses - 1
      }}}`,
    });
  }

  function handleTechniqueDuration(
    characterName,
    characterId,
    techniqueName,
    techniqueDuration
  ) {
    const turnorder = JSON.parse(Campaign().get('turnorder'));
    if (!turnorder.length) {
      return;
    }

    const isOneMinute = /minute/i.test(techniqueDuration);
    const durationLength = isOneMinute ? 10 : 1;
    const currentTurnPr = parseFloat(turnorder[0].pr);
    Durations.addDuration(
      `${characterName} - ${techniqueName}`,
      durationLength,
      currentTurnPr + 0.001
    );

    const isConcentration = /concentration/i.test(techniqueDuration);
    if (!isConcentration) {
      return;
    }
    const controlledby = getObj('character', characterId).get('controlledby');
    const playerId = controlledby.split(',').filter((id) => !playerIsGM(id))[0];
    const playerPages = Campaign().get('playerspecificpages');

    const tokenPageId =
      playerPages && playerPages[playerId]
        ? playerPages[playerId]
        : Campaign().get('playerpageid');
    const tokenToUpdate = findObjs({
      type: 'graphic',
      name: characterName,
      pageid: tokenPageId,
    });

    if (tokenToUpdate.length) {
      ConditionTracker.updateConditionInstances(
        'add',
        'concentrating--1',
        tokenToUpdate
      );
    }
  }

  function calculateTotalChiCost(baseCost, isEnhanced, characterId) {
    // Cantrips have no point cost, so a fallback of 0 is needed
    const baseChiCost = baseCost || 0;
    const enhancedCost = isEnhanced ? 2 : 0;
    const [waterbenderLevel] = getClassLevels(characterId, ['waterbender']);
    if (waterbenderLevel && baseChiCost && ATLACalendar) {
      const { app } = ATLACalendar;
      const currentDay = app.date.date.day;
      const moonPhase = app.getMoonPhase(currentDay);
      return (
        baseChiCost / (/full moon/i.test(moonPhase) ? 2 : 1) + enhancedCost
      );
    }
    return baseChiCost + enhancedCost;
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
    const attrsToGet = [
      { name: `spell_points`, parseInt: true },
      { name: `${techniqueRepRowId}name` },
      { name: `${techniqueRepRowId}duration` },
    ];

    if (techniqueLevel > 0) {
      attrsToGet.push({
        name: `spell_level_${techniqueLevel}_cost`,
        parseInt: true,
      });
    }
    const [
      chiPointsCurrent,
      techniqueName,
      techniqueDuration,
      baseTechniqueCost,
    ] = MiscScripts.getCharacterAttr(characterId, attrsToGet);

    const totalChiCost = calculateTotalChiCost(
      baseTechniqueCost,
      isEnhanced,
      characterId
    );
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
        [`spell_points`]: newTotalChiPoints,
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

    if (/1_(round|minute)/i.test(techniqueDuration)) {
      handleTechniqueDuration(
        characterName,
        characterId,
        techniqueName,
        techniqueDuration
      );
    }
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

  const CLASSES = {
    allCharacters: 'All characters',
    benders: 'Benders',
    gunslingers: 'Gunslingers',
  };
  const gainsOnLevelUp = {
    [CLASSES.allCharacters]: {},
    [CLASSES.benders]: {
      2: [
        'Gain the "Chi Recovery" feature.',
        'Learn 2 Novice level techniques.',
      ],
      3: ['Choose a Jing Path.', 'Learn 1 Novice level technique.'],
      4: ['Choose either an ASI, feat, or bending specialization.'],
      5: [
        'Gain the "Enhanced Techniques" feature.',
        'Increase base *elemental blast* damage by 1d8.',
        'Learn 1 Novice level technique.',
      ],
      6: ['Gain a Jing Path feature.'],
      7: ['Gain the "Push It" feature.', 'Learn 1 Novice level technique.'],
      8: ['Choose either an ASI, feat, or bending specialization.'],
      9: [
        'Gain the "Concentrated Chi" feature',
        'Increase base *elemental blast* damage by 1d8.',
        'Learn 1 Novice or Advanced level technique.',
      ],
      10: ['Gain a Jing Path feature.'],
      11: ['Learn 1 Novice or Advanced level technique.'],
      12: ['Choose either an ASI, feat, or bending specialization.'],
      13: [
        'Gain the "Improved Push It" feature.',
        'Learn 1 Novice or Advanced level technique.',
      ],
      14: ['Gain a Jing Path feature.'],
      15: ['Learn 1 Novice or Advanced level technique.'],
      16: ['Choose either an ASI, feat, or bending specialization.'],
      17: [
        'Increase base *elemental blast* damage by 1d8.',
        'Learn 1 Novice, Advanced, or Master level technique.',
      ],
      18: ['Gain a Jing Path feature.'],
      19: [
        'Choose either an ASI, feat, or bending specialization.',
        'Learn 1 Novice or Advanced level technique.',
      ],
      20: ['Gain the "Bending Master" feature.'],
    },
    [CLASSES.gunslingers]: {
      2: ['Choose a Gun Tactic.', 'Gain the "Gun Stunts" feature.'],
      3: ['Gain the "Lucky Item" feature.', 'Choose a Gunslinging Trail.'],
      4: ['Choose either an ASI or feat.'],
      5: ['Gain the "Bulletstorm" feature.'],
      6: ['Gain a Gunslinging Trail feature.'],
      7: ['Gain the "Evasion" feature.'],
      8: ['Choose either an ASI or feat.'],
      9: ['Gain a Gunslinging Trail feature.'],
      10: ['Choose another "Lucky Item" benefit and quirk.'],
      11: ['Gain the "Shootout Sense" feature.'],
      12: ['Choose either an ASI or feat.'],
      13: ['Gain a Gunslinging Trail feature.'],
      14: ['Gain the "Overwatch" feature.'],
      15: ['Gain the "Final Stand" feature.'],
      16: ['Choose either an ASI or feat.'],
      17: ['Gain a Gunslinging Trail feature.'],
      18: ['Gain the "Superhuman Reflexes" feature.'],
      19: ['Choose either an ASI or feat.'],
      20: [
        'Gain the "Gunslinging Supreme" feature.',
        'Gain an additional attack with firearms from the "Bulletstorm" feature.',
      ],
    },
  };
  const manualUpdatesToMake = {
    [CLASSES.allCharacters]: {
      1: [
        'Gain inspiration if you do not currently have it.',
        'Roll for hit points - add the higher of your roll or the average to the higher of your Constitution modifier or 0.',
        `Refer to the Legend of the Avatar handbook for features/resources gained at your new level.`,
      ],
    },
    [CLASSES.benders]: {
      2: ['Update max chi points to equal twice your bender level.'],
      3: [
        'Update max uses of the Chi Recovery feature to equal half your proficiency bonus, rounded down.',
        'Optionally choose a technique known and replace it with another one.',
      ],
    },
    [CLASSES.gunslingers]: [],
  };
  function messageOnLevelUp(partyLevel) {
    if (_.isNaN(partyLevel)) {
      throw new Error(`<code>${partyLevel}</code> is not a valid party level.`);
    }
    let baseMessage = `<div><div style="font-weight: bold; font-size: 1.25rem; border-bottom: 2px solid grey; padding-bottom: 4px; margin-bottom: 16px;">The party has reached level ${partyLevel}!</div>`;

    for (const characterClass in manualUpdatesToMake) {
      const characterLevels = Object.keys(manualUpdatesToMake[characterClass]);
      const validLevels = characterLevels.filter(
        (level) => parseInt(level) <= partyLevel
      );
      let classMessage = '';

      for (const level of validLevels) {
        classMessage += manualUpdatesToMake[characterClass][level]
          .map((levelItem) => `<li>${levelItem}</li>`)
          .join('');
      }

      if (gainsOnLevelUp[characterClass][partyLevel]) {
        classMessage += gainsOnLevelUp[characterClass][partyLevel]
          .map((feature) => `<li>${feature}</li>`)
          .join('');
      }

      baseMessage += classMessage
        ? `<div><div style="font-weight: bold;">${characterClass}</div><ul>${classMessage}</ul></div>`
        : '';
    }

    sendMessage({ messageToSend: `${baseMessage}</div>` });
    const track = findObjs({ type: 'jukeboxtrack', title: 'Level Up' })[0];
    // track properties don't autoset back to false after it has finished playing, so we need to manually set them to false before playing is set to true
    track.set('playing', false);
    track.set('softstop', false);
    track.set('playing', true);
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

      if (scriptName.toLowerCase() === '!lotalevelup') {
        messageOnLevelUp(parseInt(commandArgs[0]));
        return;
      }

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
        case '!lotagunslingerattack':
          gunslingerHandleFirearmAttack(restArgs, characterName, character.id);
          break;
        case '!lotagunslingersuperiority':
          gunslingerUseSuperiorityDie(restArgs, characterName, character.id);
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
