# LOTA-sheet-companion

A script to help automate resource management with a Roll20 sheet used for a homebrewed setting. Most scripts require the first argument to be a `characterId`, which is typically acquired via the syntax `@{CharacterName|character_id}`, where CharacterName is the actual character's name on their character sheet.

## General scripts

The following scripts do not pertain to any particular character class, and are more general in nature.

### Expend hit die

`!lotahd [characterId] [hitDieToExpend]`

Handles expending hit dice, including updating the current hit dice amount, rolling the hit dice, and adding the rolled amount to the character's current hit points. The amount rolled on hit dice will not exceed a character's maximum hit points after any reduction is applied.

The `hitDieToExpend` must be in the format `XdY`, where `X` is the amount of hit die to expend and `Y` is the hit die size, e.g. `1d8`. The amount of hit die to expend must be greater than 0, and the hit die size must be one that the character has access to.

### Level up

`!lotalevelup [partyLevel]`

Handles sending a message in chat to remind players what they may need to update or what features they gain at the specified `partyLevel`.

## Bender scripts

The following scripts pertain to the bender classes, which may include the Avatar class.

### Perform technique

`!lotabendertechnique [characterId] [techniqueId] [isEnhanced]`

Handles checking whether a character has enough chi points to perform a technique and either expending the necessary chi points if so, or warning the player that they cannot perform the technique if not.

Techniques are expected to be rendered in the appropriate spell level list on the character sheet:

- Cantrips => Basic level techniques
- Level 1 spells => Novice level techniques
- Level 2 spells => Advanced level techniques
- Level 3 spells => Master level techniques

The `techniqueId` argument is the `data-reprowid` attribute value of the specific technique, prefixed by `spell[level of the spell]_`. For example, an Advanced level technique with a `data-reprowid` value of "-NuQs7SepSV27zcavwMn" would have a `techniqueId` of `spell2_-NuQs7SepSV27zcavwMn`.

The `isEnhanced` argument must be a string of either "true" or "false". This determines whether additional chi points are expended when performing the technique.

### Use specialization

`!lotabenderspecialization [characterId] [specializationId] [chiCost]`

Handles using a specialization. If a specialization has limited uses per long rest, the script will update the number of uses left and expend chi points for subsequent uses.

Specializations are expected to be rendered in the "level 4" list of spells.

The `specializationId` must be the `data-reprowid` attribute value for the specific specialization. The `chiCost` must be an integer greater than or equal to 0, and will be the amount of chi points to expend if the specialization has no more uses left.

### Chi recovery

`!lotabenderspecialization [characterId] [chiRecoveryId]`

Handles expending uses of the Chi Recovery feature and updating a character's current chi points, up to their max.

The `chiRecoveryId` must be the `data-reprowid` attribute value for the Chi Recovery feature, which must be entered in the "Class features" section of the character sheet.

## Gunslinger scripts

The following scripts pertain to the gunslinger class.

### Ammo script

`!lotagunslingerammo [characterId] [command] [weaponId] [...restArgs]`

Handles ammo for the gunslinger, including updating weapon current uses and ammo amounts. This is a custom ammo script that tracks different types of ammo being loaded into the same weapon. If a weapon can be loaded with multiple types of ammo at once, the character's "ammo" inventory must include a "bulk" item and a "weapon specific" item for each ammy type. For example, "Bulk metal bullets" and "Pepperbox metal bullets".

`command` can be one of either "load", "shoot", or "status". `weaponId` must be the `data-reprowid` attribute value of a specific weapon in the character's "Offense" section of their inventory.

#### Load ammo

`!lotagunslingerammo [characterId] load [weaponId] [amountToLoad] [bulkAmmoId] [weaponAmmoId]`

Handles loading and unloading ammo from the weapon associated with the `weaponId`.

- The `amountToLoad` can be either a positive or negative integer. A positive integer will reload ammo into the specified `weaponId`, while a negative integer will unload the specified amount.
- The `bulkAmmoId` is the `data-reprowid` attribute value of the "bulk" ammo that the weapon uses.
- The `weaponAmmoId` is optional, and is the `data-reprowid` attribute value of a specific ammo associated with the specific weapon. This should be used in cases where a weapon can have multiple types of ammo loaded at once, such as metal bullets and rubber rounds.

#### Shoot ammo

`!lotagunslingerammo [characterId] shoot [weaponId] [amountToShoot] [weaponAmmoId]`

Handles expending ammo when shooting a weapon.

- The `amountToShoot` must be a positive integer.
- The `weaponAmmoId` is optional, and is the `data-reprowid` attribute value of a specific ammo associated with a specific weapon. This should be used in cases where a weapon can have multiple types of ammo loaded at once, such as metal bullets and rubber rounds.

#### Ammo status

`!lotagunslingerammo [characterId] status [weaponId] [ammiIds]`

Handles displaying the status of the specified weapon.

The `ammiIds` argument is optional, but must be a space separated list of `data-reprowid` attribute values that are associated with the specified weapon. When omitted, only the weapon name + character name, current uses, and max uses will be displayed.

### Tricks

`!lotagunslingertricks [characterId] [superiorityDieId] [trickId]`

Handles expending a superiority dice for Gunslinger tricks. When the "Sly" benefit from the "Lucky Item" feature is chosen, this will also handle checking whether any uses of the benefit remain and only expending superiority dice if so.

The `superiorityDieId` must be the `data-reprowid` attribute value that is associated with the superiority die, which must be entered in the "Utility" section of the character sheet.

The `trickId]` must be the `data-reprowid` attribute value that is associated with the particular trick, which must be entered in the "Class features" section of the character sheet. If the trick has a limited number of uses - such as from the "Sly" option of the Gunslinger's "Lucky Item" class feature - passing the classfeature id will also handle updating the trick usage and conditionally expending superiority dice if the trick has more than 0 uses remaining.
