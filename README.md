# LOTA-sheet-companion

A script to help automate resource management with a Roll20 sheet used for a homebrewed setting.

## General scripts

The following scripts do not pertain to any particular character class, and are more general in nature.

### Hit die script

`!lotahd [character id] [hit die to expend]`

Handles expending hit dice, including updating the current hit dice amount, rolling the hit dice, and adding the rolled amount to the character's current hit points. The amount rolled on hit dice will not exceed a character's maximum hit points after any reduction is applied.

The `hit die to expend` must be in the format `XdY`, where `X` is the amount of hit die to expend and `Y` is the hit die size, e.g. `1d8`. The amount of hit die to expend must be greater than 0, and the hit die size must be one that the character has access to.

## Gunslinger scripts

The following scripts pertain to the gunslinger class.

### Ammo script

`!lotagunslingerammo [character id] [command] [weapon id] [command args]`

Handles ammo for the gunslinger, including updating weapon current uses and ammo amounts. This is a custom ammo script that tracks different types of ammo being loaded into the same weapon. If a weapon can be loaded with multiple types of ammo at once, the character's "ammo" inventory must include a "bulk" item and a "weapon specific" item for each ammy type. For example, "Bulk metal bullets" and "Pepperbox metal bullets".

`command` can be one of either "load", "shoot", or "status". `weapon id` must be a valid id of a weapon in the character's "offense" inventory.

#### Load ammo

`!lotagunslingerammo [character id] load [weapon id] [amount to load] [bulk ammo id] [weapon ammo id]`

Handles loading and unloading ammo from the weapon associated with the `weapon id`.

- The `amount to load` can be either a positive or negative integer. A positive integer will reload ammo into the specified `weapon id`, while a negative integer will unload the specified amount.
- The `bulk ammo id` is the id of the ammo that the weapon uses.
- The `weapon ammo id` is optional, and is the id of a specific ammo associated with the specific weapon. This should be used in cases where a weapon can have multiple types of ammo loaded at once, such as metal bullets and rubber rounds.

#### Shoot ammo

`!lotagunslingerammo [character id] load [weapon id] [amount to shoot] [weapon ammo id]`

Handles expending ammo when shooting a weapon.

- The `amount to shoot` must be a positive integer.
- The `weapon ammo id` is optional, and is the id of a specific ammo associated with the specific weapon. This should be used in cases where a weapon can have multiple types of ammo loaded at once, such as metal bullets and rubber rounds.

#### Ammo status

`!lotagunslingerammo [character id] load [weapon id] [space separated list of ammo ids]`

Handles displaying the status of the specified weapon.

The `space separated list of ammo ids` is optional, but must be a list of ids that are associated with the specified weapon. When omitted, only the weapon name + character name, current uses, and max uses will be displayed.
