# Unholium: real physics plan

Status: first stage done (one body falling and being hit). Nothing in the game uses it yet. Everything below waits for approval of that test.

## Why it can survive the move to 3D
`js/game/physbody.js` works in metres, in three dimensions, and has no drawing in it. The current top-down view is one way of looking at it (`js/game/physview.js`). When the engine goes 3D, the simulation stays and the view changes.

## How it connects to what exists

| Today | File | What happens to it |
|---|---|---|
| Painted skeleton, poses, frame cache | `realbody.js`, `fighting.js`, `hdchars.js` | Stays for normal walking, talking and working. Physics takes over only when a body is hit or falling, then hands back. |
| Knockback (`kbx`, `kby`), hit-stop, stagger | `combat.js`, `combat2.js`, `physics.js`, `extras.js` | Blows become impulses. Damage rules stay. Knockback sliding is replaced for close bodies. |
| Melee | `melee.js`, `combatreal.js`, `knockout.js` | Hit point and direction come from the swing. Knockout rules stay, and also reduce muscle tone. |
| Guns and stabbing | `firearms.js`, `aid.js` | The bullet's path gives the joint hit. Wounds set limb strength. |
| People thrown by cars | `crashes.js`, `vehicles.js`, `drivers.js` | The scripted throw is replaced by real impact. Cars get mass and reaction from the hit. |
| Swimming | `player.js`, swim checks in many files | Buoyancy and drag on the same body. Swimming controls stay. |
| Corpses, dragging, carrying | `bodies.js`, `aid.js` | Corpses settle as bodies and can be dragged by a joint. |
| Dropped items, casings, wreck pieces | `groundloot.js`, `physics.js`, `explosions.js` | Simple rigid objects on the same ground and walls. |

## Order of work
1. Blend: a body leaves its animation for physics and returns to it, with the same look. The ragdoll painter must reach the quality of the sprites (clothes, hair, face turned the right way) or it is a downgrade.
2. Map collision: real walls, furniture and floors in place of the test room.
3. Fighting: fists and melee weapons as impulses.
4. Guns and stabbing, with lasting wounds that change how a person moves, including crawling.
5. Vehicles against people, and cars reacting.
6. Falls from height.
7. Water.
8. Corpses, dragging, thrown and dropped items.

## Keeping it at 60 fps
Full physics only for bodies near the player that were hit, are falling or lying fresh. Others keep animation. Measured so far: about 70 µs a body per frame, 30 bodies about 2 ms, before drawing. A limit on active bodies stays even so, and corpses that have settled stop simulating.

## Co-op
The host decides hits, as it does now, and sends the blow (joint, direction, impulse, seed). Each machine simulates the fall locally and the host's position corrects it when the body settles. Exact matching frame by frame between machines is not the goal.

## Saves
Physics state is not saved. A body in mid-fall on saving loads settled where it was. Old saves need nothing new. Any new lasting wounds load with defaults.

## Fairness
Physics decides how something looks and where a body ends up, not who wins a fight on chance. Damage stays in the current rules. The player keeps control whenever able, with limits on how long the player can be down from one ordinary blow.
