/**
 * 素材路径集中管理
 * 正式界面只用相对 URL；参考截图勿混入此表。
 *
 * 归档源（本机）：
 *   神女控2/.../Battle/Map          → 活动/世界地图背景（可轮换）
 *   神女控2/.../Battle/Background   → 闯关战斗背景
 *   神女控2/.../Audio/stream        → BGM（Battle/Audio 目录为空，改用此处）
 */

/** 活动 / 女神地图背景（归档 Battle/Map 全量 133 张；首页轮播 + 战役进军图） */
export const EVENT_MAP_BGS: string[] = [
  '/archive/map/AreaMap_001.Celestial Realm Campaign 1.png',
  '/archive/map/AreaMap_002_003.Utopian Illusion.Utopian Illusion.png',
  '/archive/map/AreaMap_002_004.Find Miss Academy.World Of the Gods Academy.png',
  '/archive/map/AreaMap_002_005.Enchanted Forest Storyteller.The Fairy Kingdom.png',
  '/archive/map/AreaMap_002_006.World of the Gods Resort.World of the Gods Resort.png',
  '/archive/map/AreaMap_002_007.Spacetime Archwitches.Realm between Space and Time.png',
  '/archive/map/AreaMap_002_008.Gods of the Starry Skies.Heaven Galaxy.png',
  '/archive/map/AreaMap_002_009.Maidens in Love.Maidens Garden.png',
  '/archive/map/AreaMap_002_010.Get Back the Halloween Cookies.Halloween Land.png',
  '/archive/map/AreaMap_002_011.WotG Casino.WotG Casino.png',
  '/archive/map/AreaMap_002_013.Celestial Realm on Earth.Xmas Town.png',
  '/archive/map/AreaMap_002_014.A Celestial Realm Xmas.Xmas Town Too.png',
  '/archive/map/AreaMap_002_015.A Celestial Realm New Year.Shrine of the Gods.png',
  '/archive/map/AreaMap_002_016.A Valkyrie Valentine.Sweetland.png',
  '/archive/map/AreaMap_002_017.Doll Festival Rumble.Peachland.png',
  '/archive/map/AreaMap_002_018.Celestial Jubilee.Dawn of the Gods.png',
  '/archive/map/AreaMap_002_019.Maid in Heaven.Maid Manor.png',
  '/archive/map/AreaMap_002_020.School of Valkyries.Celestial Academy.png',
  '/archive/map/AreaMap_002_021..Beginners Dungeon.png',
  '/archive/map/AreaMap_002_022.Cybercity.Cybercity.png',
  '/archive/map/AreaMap_002_023.Dark Alice and the Bewildering Wood.Old Woodland Road.png',
  '/archive/map/AreaMap_002_024.A Circus Darkly.Circus Grounds.png',
  '/archive/map/AreaMap_002_025.The Three Steps of Love.Lovers Paradise.png',
  '/archive/map/AreaMap_002_026.Terror Town.Terror Town.png',
  '/archive/map/AreaMap_002_027.Dreamy Destination.Bewitching Beaches.png',
  '/archive/map/AreaMap_002_028.Celestial Fireworks.Festiville.png',
  '/archive/map/AreaMap_002_029.Sacred Beasts of the Forest.Roots of the Godtree.png',
  '/archive/map/AreaMap_002_030.Celestial Treasure.Secret Ruins.png',
  '/archive/map/AreaMap_002_031.Galactic Journey.Astral Nexus.png',
  '/archive/map/AreaMap_002_032.A Celestial Saga.Field of Glory.png',
  '/archive/map/AreaMap_002_033.Pirates of the Sky.Islands in the Sky.png',
  '/archive/map/AreaMap_002_034.A Happy Halloween.Halloween Castle.png',
  '/archive/map/AreaMap_002_035.Sengoku in Autumn.Crimson Gardens.png',
  '/archive/map/AreaMap_002_036.Our Ladies of Solace.Phantasmal Spa.png',
  '/archive/map/AreaMap_002_037.Valkyrie Kingdom.Kingdom Streets.png',
  '/archive/map/AreaMap_002_038.Secret Santa.Christmas Village.png',
  '/archive/map/AreaMap_002_039.The Four Guardians.Altars of the Four.png',
  '/archive/map/AreaMap_002_040.Celestial Cat-astrophe.Catgirl Clinic.png',
  '/archive/map/AreaMap_002_041.Witch Gates Galore.Land of Ruin.png',
  '/archive/map/AreaMap_002_042.Chocolate Wars.Battlefield of Love.png',
  '/archive/map/AreaMap_002_043.Celestial Drinking Party.Party Venue.png',
  '/archive/map/AreaMap_002_044.Maidens and Magic Weapons.Alfheim.png',
  '/archive/map/AreaMap_002_045.Celestial Jubilee II.Return of the Gods.png',
  '/archive/map/AreaMap_002_046.Victoria the Vampire Princess.Vampire Manor.png',
  '/archive/map/AreaMap_002_047.Celestial Battle Royal.BATTLE STAGE.png',
  '/archive/map/AreaMap_002_048.Celestial Pilgrimage: Training.Training Grounds.png',
  '/archive/map/AreaMap_002_049.Celestial Pilgrimage: The Final Battle.The Road to Battle.png',
  '/archive/map/AreaMap_002_050.Celestial Studio Tour.Celestial Studios.png',
  '/archive/map/AreaMap_002_051.Celestial Railway.Cosmic Passage.png',
  '/archive/map/AreaMap_002_052..Castle Thunder.png',
  '/archive/map/AreaMap_002_053.Celestial Grand Prix.Valkyrie Raceway.png',
  '/archive/map/AreaMap_002_054.The Oracles Day Off.Celestial Oasis.png',
  '/archive/map/AreaMap_002_055.The Stolen Grimoire.Mount Brimstone.png',
  '/archive/map/AreaMap_002_056.The Fairies New Wings.Feywood.png',
  '/archive/map/AreaMap_002_057.The Alchemist and the Magic Spell.To Castle Diabolis.png',
  '/archive/map/AreaMap_002_058..Beginners Dungeon.png',
  '/archive/map/AreaMap_002_059.The Outskirts of Town.Mystery District.png',
  '/archive/map/AreaMap_002_060..Hamlet of Secrets.png',
  '/archive/map/AreaMap_002_061.Halloween Night.Halloween Parade.png',
  '/archive/map/AreaMap_002_062.Cyberwars.Neo City.png',
  '/archive/map/AreaMap_002_063.The Watcher in the Sky.The Floating Isles.png',
  '/archive/map/AreaMap_002_064.The Celestial Slayer.Uruk.png',
  '/archive/map/AreaMap_002_065.A Celestial Adventure.Christmas Town.png',
  '/archive/map/AreaMap_002_066.A Celestial Shrine Visit.Divine Light Shrine.png',
  '/archive/map/AreaMap_002_067.Sisterhood of Thieves.Kingdom Imperiled.png',
  '/archive/map/AreaMap_002_068.Valentines Day Grand Prix.Valentine Venue.png',
  '/archive/map/AreaMap_002_069.Desert Dreams.City in the Sand.png',
  '/archive/map/AreaMap_002_070.The Tyrant.The Realm of Dong Zhuo.png',
  '/archive/map/AreaMap_002_071.Celestial Jubilee III.Carnival Grounds.png',
  '/archive/map/AreaMap_002_072.Princess in Peril.Gloomwood.png',
  '/archive/map/AreaMap_002_073.Academy Battle.Celestial Academy 16.png',
  '/archive/map/AreaMap_002_074.Valkyrie Wars.Hell Star.png',
  '/archive/map/AreaMap_002_075.War Goddess Comeback.Land of Neutrality.png',
  '/archive/map/AreaMap_002_076.The Stolas Sisters.Clock Tower of Owl Woods.png',
  '/archive/map/AreaMap_002_077.Rhapsody of the Dark Princess.Ballroom Palace.png',
  '/archive/map/AreaMap_002_078.Follow Your Dreams: Idols Live.Starlight Theater.png',
  '/archive/map/AreaMap_002_079.A Celestial Vacation.Poseidon Beach.png',
  '/archive/map/AreaMap_002_080.Ice Wolves and Summer Snow.Isles of Summer Snow.png',
  '/archive/map/AreaMap_002_081.A Haunting Mystery.Mansion on the Edge of Town.png',
  '/archive/map/AreaMap_002_082.Moonlight Rumble.Lunar Party Hall.png',
  '/archive/map/AreaMap_002_083.Bounty Hunt.Wanted List.png',
  '/archive/map/AreaMap_002_084.Summer Ends With a Bang.Celestial Fireworks Festival.png',
  '/archive/map/AreaMap_002_085.The Temple in the Sand.Breidablik Temple.png',
  '/archive/map/AreaMap_002_086.Halloween Confessions Can Wait.Halloweenland.png',
  '/archive/map/AreaMap_002_087.Bounty Hunt in Progress.Wanted List.png',
  '/archive/map/AreaMap_002_088.A Dark and Dreary Autumn.Wrath of the Storm Goddess.png',
  '/archive/map/AreaMap_002_089.Invaders.Bewitched Palace.png',
  '/archive/map/AreaMap_002_090.Relenas Challenge.Open Gate.png',
  '/archive/map/AreaMap_002_091.The Immortal Queens Request.Forest of the Wondrous Spring.png',
  '/archive/map/AreaMap_002_092.Holy Night No One at the Gate.Destination: Christmas Tree.png',
  '/archive/map/AreaMap_002_093.Relenas 2nd Challenge.Open Gate.png',
  '/archive/map/AreaMap_002_094.New Years Fun and Games.Playground of the Gods.png',
  '/archive/map/AreaMap_002_095.Sallys Dress Dilemma.The Dance Plaza.png',
  '/archive/map/AreaMap_002_096.Relenas 3rd Challenge.Open Gate.png',
  '/archive/map/AreaMap_002_097.Valentines Day Chocolate Hunt.Cacao Road.png',
  '/archive/map/AreaMap_002_098.A Dancers Depression.Carnival Festival.png',
  '/archive/map/AreaMap_002_099.Relena Training Event.Open Gate.png',
  '/archive/map/AreaMap_002_100.Visitors from on High.The Citadel in the Sky.png',
  '/archive/map/AreaMap_002_101.The Rarest of Stones.Celestite Mine.png',
  '/archive/map/AreaMap_002_102.Whitecloths Great Awakening.Open Gate.png',
  '/archive/map/AreaMap_002_103.Celestial Jubilee IV.Fourth Annual Jubilee.png',
  '/archive/map/AreaMap_002_104.The Day The Music Almost Died.Lunes Mansion.png',
  '/archive/map/AreaMap_002_105.The Banisher of Disease.The Pass of Zhong Kui.png',
  '/archive/map/AreaMap_002_106.In the Dungeon Depths.Daedaluss Labyrinth.png',
  '/archive/map/AreaMap_002_107.Grimoire Quest.Leirias Library.png',
  '/archive/map/AreaMap_002_108.The Perfect Temptation.Kingdom in Chaos.png',
  '/archive/map/AreaMap_002_109.The Blundering Sun Goddess.Summertime Beach.png',
  '/archive/map/AreaMap_002_110.An Interstellar Journey.The Interstellar Line.png',
  '/archive/map/AreaMap_002_111.Her First Test.The Road to Success.png',
  '/archive/map/AreaMap_002_112.A New Gateway.Elis, City of the Infernal Realm.png',
  '/archive/map/AreaMap_002_113.Pumpkin Panic.Pumpkin Kingdom.png',
  '/archive/map/AreaMap_002_114.The Spring of the Goddess Krene.The Spring of the Goddess Krene.png',
  '/archive/map/AreaMap_002_115.The Stolas Sisters Strike Again.Owl Woods Winter.png',
  '/archive/map/AreaMap_002_116.In Search of the Wondrous Cacao.Forest of the Wondrous Cacao.png',
  '/archive/map/AreaMap_002_117.The Brilliant Invader.Sun Ces Battlefield.png',
  '/archive/map/AreaMap_002_118.Labs Are Meant for Exploding.Mount Megahardite.png',
  '/archive/map/AreaMap_002_119.The Slimefolks Treasure Amended.The Road to Slime Village.png',
  '/archive/map/AreaMap_002_120.The Demon Minister Juggernaut.Mount Hephaestus.png',
  '/archive/map/AreaMap_002_121.Beyond the Spacetime Gate.Spacetime Islands.png',
  '/archive/map/AreaMap_002_122.The Mermaids of Summer.Mermaid Beach.png',
  '/archive/map/AreaMap_002_123.Awakening Rage.Thrymheim.png',
  '/archive/map/AreaMap_002_124.The Evil Beyond the Walls.The Abandoned Castle.png',
  '/archive/map/AreaMap_002_125.The Stolas Sisters: Never Say Die.Autumn Owl Forest.png',
  '/archive/map/AreaMap_002_126.The Lure of the Sea Bottom.Sea Shrine.png',
  '/archive/map/AreaMap_002_127.The Accursed Queen.Googo, Town of Demons.png',
  '/archive/map/AreaMap_002_128.The Valentines Day Caper.Kingdom Sweet Kingdom.png',
  '/archive/map/AreaMap_002_129.Battle Maiden Training Ground.Battle Maiden Training Ground.png',
  '/archive/map/AreaMap_002_130.Battle Maiden Training Ground.Battle Maiden Training Ground.png',
  '/archive/map/AreaMap_002_78.Celestial Academy 16.png',
  '/archive/map/AreaMap_003.Celestial Realm Campaign 2.png',
  '/archive/map/AreaMap_004.Beginners Dungeon.png',
  '/archive/map/AreaMap_006.Celestial Academy 16.png',
  '/archive/map/AreaMap_101.Eldrich Gates - original game map.png',
];

/** 闯关 / 讨伐战斗背景（归档 Battle/Background 全量 128 张） */
export const BATTLE_BGS: string[] = [
  '/archive/battle-bg/BattleBG_001.png',
  '/archive/battle-bg/BattleBG_002.png',
  '/archive/battle-bg/BattleBG_003.png',
  '/archive/battle-bg/BattleBG_004.png',
  '/archive/battle-bg/BattleBG_005.png',
  '/archive/battle-bg/BattleBG_006.png',
  '/archive/battle-bg/BattleBG_007.png',
  '/archive/battle-bg/BattleBG_008.png',
  '/archive/battle-bg/BattleBG_009.png',
  '/archive/battle-bg/BattleBG_010.png',
  '/archive/battle-bg/BattleBG_012.png',
  '/archive/battle-bg/BattleBG_014.png',
  '/archive/battle-bg/BattleBG_015.png',
  '/archive/battle-bg/BattleBG_016.png',
  '/archive/battle-bg/BattleBG_017.png',
  '/archive/battle-bg/BattleBG_018.png',
  '/archive/battle-bg/BattleBG_019.png',
  '/archive/battle-bg/BattleBG_020.png',
  '/archive/battle-bg/BattleBG_021.png',
  '/archive/battle-bg/BattleBG_022.png',
  '/archive/battle-bg/BattleBG_023.png',
  '/archive/battle-bg/BattleBG_027.png',
  '/archive/battle-bg/BattleBG_028.png',
  '/archive/battle-bg/BattleBG_029.png',
  '/archive/battle-bg/BattleBG_030.png',
  '/archive/battle-bg/BattleBG_031.png',
  '/archive/battle-bg/BattleBG_032.png',
  '/archive/battle-bg/BattleBG_033.png',
  '/archive/battle-bg/BattleBG_034.png',
  '/archive/battle-bg/BattleBG_035.png',
  '/archive/battle-bg/BattleBG_036.png',
  '/archive/battle-bg/BattleBG_037.png',
  '/archive/battle-bg/BattleBG_038.png',
  '/archive/battle-bg/BattleBG_039.png',
  '/archive/battle-bg/BattleBG_040.png',
  '/archive/battle-bg/BattleBG_041.png',
  '/archive/battle-bg/BattleBG_042.png',
  '/archive/battle-bg/BattleBG_045.png',
  '/archive/battle-bg/BattleBG_046.png',
  '/archive/battle-bg/BattleBG_047.png',
  '/archive/battle-bg/BattleBG_048.png',
  '/archive/battle-bg/BattleBG_049.png',
  '/archive/battle-bg/BattleBG_050.png',
  '/archive/battle-bg/BattleBG_051.png',
  '/archive/battle-bg/BattleBG_052.png',
  '/archive/battle-bg/BattleBG_053.png',
  '/archive/battle-bg/BattleBG_054.png',
  '/archive/battle-bg/BattleBG_055.png',
  '/archive/battle-bg/BattleBG_056.png',
  '/archive/battle-bg/BattleBG_057.png',
  '/archive/battle-bg/BattleBG_058.png',
  '/archive/battle-bg/BattleBG_059.png',
  '/archive/battle-bg/BattleBG_060.png',
  '/archive/battle-bg/BattleBG_061.png',
  '/archive/battle-bg/BattleBG_062.png',
  '/archive/battle-bg/BattleBG_063.png',
  '/archive/battle-bg/BattleBG_064.png',
  '/archive/battle-bg/BattleBG_065.png',
  '/archive/battle-bg/BattleBG_066.png',
  '/archive/battle-bg/BattleBG_067.png',
  '/archive/battle-bg/BattleBG_068.png',
  '/archive/battle-bg/BattleBG_069.png',
  '/archive/battle-bg/BattleBG_070.png',
  '/archive/battle-bg/BattleBG_071.png',
  '/archive/battle-bg/BattleBG_072.png',
  '/archive/battle-bg/BattleBG_073.png',
  '/archive/battle-bg/BattleBG_074.png',
  '/archive/battle-bg/BattleBG_075.png',
  '/archive/battle-bg/BattleBG_076.png',
  '/archive/battle-bg/BattleBG_077.png',
  '/archive/battle-bg/BattleBG_078.png',
  '/archive/battle-bg/BattleBG_079.png',
  '/archive/battle-bg/BattleBG_080.png',
  '/archive/battle-bg/BattleBG_081.png',
  '/archive/battle-bg/BattleBG_082.png',
  '/archive/battle-bg/BattleBG_083.png',
  '/archive/battle-bg/BattleBG_084.png',
  '/archive/battle-bg/BattleBG_085.png',
  '/archive/battle-bg/BattleBG_086.png',
  '/archive/battle-bg/BattleBG_087.png',
  '/archive/battle-bg/BattleBG_088.png',
  '/archive/battle-bg/BattleBG_089.png',
  '/archive/battle-bg/BattleBG_090.png',
  '/archive/battle-bg/BattleBG_091.png',
  '/archive/battle-bg/BattleBG_092.png',
  '/archive/battle-bg/BattleBG_093.png',
  '/archive/battle-bg/BattleBG_094.png',
  '/archive/battle-bg/BattleBG_095.png',
  '/archive/battle-bg/BattleBG_096.png',
  '/archive/battle-bg/BattleBG_097.png',
  '/archive/battle-bg/BattleBG_098.png',
  '/archive/battle-bg/BattleBG_099.png',
  '/archive/battle-bg/BattleBG_100.png',
  '/archive/battle-bg/BattleBG_101.png',
  '/archive/battle-bg/BattleBG_102.png',
  '/archive/battle-bg/BattleBG_103.png',
  '/archive/battle-bg/BattleBG_104.png',
  '/archive/battle-bg/BattleBG_105.png',
  '/archive/battle-bg/BattleBG_106.png',
  '/archive/battle-bg/BattleBG_107.png',
  '/archive/battle-bg/BattleBG_108.png',
  '/archive/battle-bg/BattleBG_109.png',
  '/archive/battle-bg/BattleBG_110.png',
  '/archive/battle-bg/BattleBG_111.png',
  '/archive/battle-bg/BattleBG_112.png',
  '/archive/battle-bg/BattleBG_113.png',
  '/archive/battle-bg/BattleBG_114.png',
  '/archive/battle-bg/BattleBG_116.png',
  '/archive/battle-bg/BattleBG_117.png',
  '/archive/battle-bg/BattleBG_118.png',
  '/archive/battle-bg/BattleBG_119.png',
  '/archive/battle-bg/BattleBG_120.png',
  '/archive/battle-bg/BattleBG_121.png',
  '/archive/battle-bg/BattleBG_122.png',
  '/archive/battle-bg/BattleBG_123.png',
  '/archive/battle-bg/BattleBG_500.png',
  '/archive/battle-bg/BattleBG_501.png',
  '/archive/battle-bg/BattleBG_502.png',
  '/archive/battle-bg/BattleBG_503.png',
  '/archive/battle-bg/BattleBG_600.png',
  '/archive/battle-bg/BattleBG_601.png',
  '/archive/battle-bg/BattleBG_602.png',
  '/archive/battle-bg/BattleBG_603.png',
  '/archive/battle-bg/BattleBG_610.png',
  '/archive/battle-bg/BattleBG_611.png',
  '/archive/battle-bg/BattleBG_612.png',
  '/archive/battle-bg/BattleBG_613.png',
  '/archive/battle-bg/BattleBG_620.png',
];

/** 场景 BGM */
export const BGM = {
  main: '/archive/bgm/bgm_001 Main Theme.ogg',
  kingdom: '/archive/bgm/bgm_002 Kingdom.ogg',
  campaign: '/archive/bgm/bgm_003 Campaign.ogg',
  battle: '/archive/bgm/bgm_004 Battle.ogg',
  eventMap: '/archive/bgm/bgm_007 Event Map.ogg',
  archwitch: '/archive/bgm/bgm_005 Archwitch.ogg',
  fantasyArchwitch: '/archive/bgm/bgm_006 Fantasy Archwitch.ogg',
} as const;

/** 看板娘立绘（归档 Navi-Sprites 全量 74 张；知名向导角色在前，轮播优先） */
export const NAVI_SPRITES: string[] = [
  '/archive/navi/navi_Oracle.png',
  '/archive/navi/navi_Alchemist.png',
  '/archive/navi/navi_Itsuki.png',
  '/archive/navi/navi_sumire.png',
  '/archive/navi/navi_wisteria.png',
  '/archive/navi/navi_primila.png',
  '/archive/navi/navi_prikat.png',
  '/archive/navi/navi_mia_h.png',
  '/archive/navi/navi_mia2_h.png',
  '/archive/navi/navi_jodie2.png',
  '/archive/navi/navi_Calamity_2.png',
  '/archive/navi/navi_hades_2.png',
  '/archive/navi/navi_typhon.png',
  '/archive/navi/navi_ebony.png',
  '/archive/navi/navi_cairn.png',
  '/archive/navi/navi_demis.png',
  '/archive/navi/navi_desastre.png',
  '/archive/navi/navi_jigan.png',
  '/archive/navi/navi_zelzarl.png',
  '/archive/navi/navi_apricot.png',
  '/archive/navi/navi_20.png',
  '/archive/navi/navi_21.png',
  '/archive/navi/navi_40.png',
  '/archive/navi/navi_41.png',
  '/archive/navi/navi_42.png',
  '/archive/navi/navi_43.png',
  '/archive/navi/navi_44.png',
  '/archive/navi/navi_46.png',
  '/archive/navi/navi_47.png',
  '/archive/navi/navi_48.png',
  '/archive/navi/navi_49.png',
  '/archive/navi/navi_50.png',
  '/archive/navi/navi_51.png',
  '/archive/navi/navi_52.png',
  '/archive/navi/navi_54.png',
  '/archive/navi/navi_55.png',
  '/archive/navi/navi_56.png',
  '/archive/navi/navi_57.png',
  '/archive/navi/navi_58.png',
  '/archive/navi/navi_60.png',
  '/archive/navi/navi_62.png',
  '/archive/navi/navi_63.png',
  '/archive/navi/navi_64.png',
  '/archive/navi/navi_65.png',
  '/archive/navi/navi_67.png',
  '/archive/navi/navi_69.png',
  '/archive/navi/navi_72.png',
  '/archive/navi/navi_74.png',
  '/archive/navi/navi_76.png',
  '/archive/navi/navi_78.png',
  '/archive/navi/navi_79.png',
  '/archive/navi/navi_80.png',
  '/archive/navi/navi_81.png',
  '/archive/navi/navi_82.png',
  '/archive/navi/navi_86.png',
  '/archive/navi/navi_87.png',
  '/archive/navi/navi_88.png',
  '/archive/navi/navi_90.png',
  '/archive/navi/navi_91.png',
  '/archive/navi/navi_92.png',
  '/archive/navi/navi_94.png',
  '/archive/navi/navi_95.png',
  '/archive/navi/navi_97.png',
  '/archive/navi/navi_99.png',
  '/archive/navi/navi_100.png',
  '/archive/navi/navi_101.png',
  '/archive/navi/navi_102.png',
  '/archive/navi/navi_103.png',
  '/archive/navi/navi_105.png',
  '/archive/navi/navi_106.png',
  '/archive/navi/navi_107.png',
  '/archive/navi/navi_108.png',
  '/archive/navi/navi_109.png',
  '/archive/navi/navi_110.png',
];

/** 看板娘角色名（文件名 → 显示名；编号立绘无专属名） */
export const NAVI_NAMES: Record<string, string> = {
  navi_Oracle: '神谕者', navi_Alchemist: '炼金术士', navi_Itsuki: '树',
  navi_sumire: '堇', navi_wisteria: '紫藤', navi_primila: '普莉米拉',
  navi_prikat: '普莉卡特', navi_mia_h: '米娅', navi_mia2_h: '米娅·花嫁',
  navi_jodie2: '乔迪', navi_Calamity_2: '灾厄魔女', navi_hades_2: '哈迪斯',
  navi_typhon: '提丰', navi_ebony: '乌木', navi_cairn: '凯恩',
  navi_demis: '德米斯', navi_desastre: '灾星', navi_jigan: '次元',
  navi_zelzarl: '泽尔扎尔', navi_apricot: '杏',
};

export function naviSprite(index: number): string {
  return NAVI_SPRITES[((index % NAVI_SPRITES.length) + NAVI_SPRITES.length) % NAVI_SPRITES.length];
}

/** 从立绘路径取显示名 */
export function naviName(src: string): string {
  const base = src.split('/').pop()?.replace('.png', '') ?? '';
  return NAVI_NAMES[base] ?? `看板娘 No.${base.replace('navi_', '')}`;
}

/** 强化药水（Items/Enhancement，探索掉落） */
export const ENHANCE_POTION = {
  icon: '/archive/items/Upgrade Potion.png',
  name: '强化药水',
  desc: '使用后为目标卡提供大量经验',
} as const;

/** 宝箱（卡包）：战斗胜利奖励，开启出卡片 */
export const CHEST = {
  bronze: '/archive/items/Card Bag (R).png',
  silver: '/archive/items/Card Bag (SR).png',
  gold: '/archive/items/Card Bag (UR).png',
} as const;
export type ChestQuality = keyof typeof CHEST;

/** 强化道具图标（Items/Enhancement 目录全量，未用之预备） */
export const ENHANCE_ITEM_ICONS: string[] = [
  '/archive/items/Miracle Drop (Login Bonus).png',
  '/archive/items/Miracle Drop (Voyage).png',
  '/archive/items/Miracle Drop＋(Limited-Time).png',
  '/archive/items/Miracle Drop＋(Voyage).png',
  '/archive/items/Mysterious Drop (Login Bonus).png',
  '/archive/items/Mysterious Drop (Soul Weapon).png',
  '/archive/items/Mysterious Drop＋ (Soul Weapon).png',
  '/archive/items/Spirit Drop (Login Bonus).png',
  '/archive/items/Spirit Drop (Tower).png',
  '/archive/items/Spirit Drop＋ (Tower).png',
  '/archive/items/Upgrade Potion+.png',
  '/archive/items/Upgrade Potion.png',
];

export type BgmKey = keyof typeof BGM;

export function eventMapBg(index: number): string {
  return EVENT_MAP_BGS[((index % EVENT_MAP_BGS.length) + EVENT_MAP_BGS.length) % EVENT_MAP_BGS.length];
}

export function battleBg(index: number): string {
  return BATTLE_BGS[((index % BATTLE_BGS.length) + BATTLE_BGS.length) % BATTLE_BGS.length];
}

/** 简单图片缓存 */
const cache = new Map<string, HTMLImageElement>();

export function loadAssetImage(src: string): HTMLImageElement {
  let img = cache.get(src);
  if (img) return img;
  img = new Image();
  img.src = src;
  cache.set(src, img);
  return img;
}

/** 限量缓存加载器：轮播大图专用（133 地图 / 74 立绘全量驻留会爆内存，只保留最近几张） */
export class RotationLoader {
  private cache = new Map<string, HTMLImageElement>();
  constructor(private maxKeep = 6) {}
  get(src: string): HTMLImageElement {
    let img = this.cache.get(src);
    if (img) {
      // LRU：命中后移到末尾
      this.cache.delete(src);
      this.cache.set(src, img);
      return img;
    }
    img = new Image();
    img.src = src;
    this.cache.set(src, img);
    while (this.cache.size > this.maxKeep) {
      const oldest = this.cache.keys().next().value!;
      this.cache.delete(oldest);
    }
    return img;
  }
}

/** cover 绘制（铺满画布，可裁边） */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  alpha = 1,
): void {
  if (!img.complete || !img.naturalWidth) return;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale, dh = ih * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  ctx.restore();
}
