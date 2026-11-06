#!/bin/bash
# every test group, one process each, no browser
cd /d/Unholium_native/native; L="${1:-suiteHead,physBody,pieces,perfSame,vehicleWrecks,coopFind,bloodFixes,talkFixes,playFixes,smallFixes,padPlay,demandFight,edgesCars,interiors,homeLife,venues,fightClub,quality,audioScore,audit2,newFeatures,skillsAndItems,lifeSystems,worldSystems,dailyLife,loveLife,streetLife,polish,cityLife,batch3,crashes,knockouts,aid,realism,gunmen,brainLevels,fireStarting,emergency,laterFixes,lawAndOrder,uiWindows,quickload,aiDialogue,eagleMaps,trading,companionMood,aiJobs,aiFollow,npcLife,welcome,awareness,npcTalk,aiUpdate,language,prisonPatch,clubBuilding,estate,cityFinish,textures,grit,signs,wetClothes,itemIcons,uiWorn,playthrough,treeRoofs}"; ok=0; bad=0
for g in $(echo $L | tr ',' ' '); do r=$(timeout 420 ../tools/node/node.exe test_runner.js $g 2>&1 | tail -14); [ -z "$r" ] && r="$g NO RESULT"; echo "$r" | cut -c1-280; done
echo ALL DONE
