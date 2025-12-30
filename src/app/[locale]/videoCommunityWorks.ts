const videoCommunityWorks = [
    { 
        id: 1, 
        image: '/images/video-community/video-demo-1.png', 
        video: '/images/video-community/video-demo-1.mp4',
        prompt: '蓝发天使少女，身穿水手服，头戴光环，站在晴空下微笑，微风轻拂长发，裙摆随风轻扬，镜头缓慢环绕，阳光洒落，画面明亮清新，超详细，流畅运动，稳定画面。' 
    },
    { 
        id: 2, 
        image: '/images/video-community/video-demo-2.png', 
        video: '/images/video-community/video-demo-2.mp4',
        prompt: '一位拥有银白色长发和猫耳的少女，身穿白色连帽衫与白色短裤，在深蓝色的海底缓缓下沉。阳光从水面穿透而下，形成柔和的光束，照亮她飘动的发丝与周围漂浮的气泡。她闭着眼睛，神情宁静，手中轻握着两个发光的蓝色猫形小灯，仿佛在梦中沉入水底。画面整体呈现日系动漫风格，细腻的光影与水下粒子效果营造出梦幻、静谧的氛围。镜头缓慢下移，伴随轻微的水流波动，展现她优雅沉落的姿态。超详细，流畅运动，稳定画面，4K高清。' 
    },
    { 
        id: 3, 
        image: '/images/video-community/video-demo-3.png', 
        video: '/images/video-community/video-demo-3.mp4',
        prompt: 'Rain slashes the night market—a scholar clutches his stall\'s collapsing canopy. Then, a white fox shakes itself dry under his eaves, whispering: "Your manuscript bleeds." He looks down: ink blossoms into peach petals across the drowned pages of Strange Tales.' 
    },
    { 
        id: 4, 
        image: '/images/video-community/video-demo-4.png', 
        video: '/images/video-community/video-demo-4.mp4',
        prompt: '一位拥有蓝色水晶鹿角与精灵耳的金发女精灵，身着蓝黑相间的华丽战斗装束，站在木质码头上。背景是中式古风建筑与平静水面，远处有彩虹光晕。她缓缓转身，长发随风飘扬，衣摆轻扬，目光温柔而坚定。整体画面采用写实风格，超高清细节，流畅运动，稳定画面，光影柔和，氛围宁静而神秘。' 
    },
    { 
        id: 5, 
        image: '/images/video-community/video-demo-5.png', 
        video: '/images/video-community/video-demo-5.mp4',
        prompt: "粉色长发新娘身着洁白婚纱，头戴花环与轻纱头纱，手持粉色花束，于漫天飘落的樱花瓣中缓缓鞠躬，随后优雅起身，裙摆随风轻扬，花瓣在阳光下闪烁，画面呈现柔和梦幻的动漫风格，镜头稳定流畅，细节精致，情绪温柔宁静。"
    },
    { 
        id: 6, 
        image: '/images/video-community/video-demo-6.png', 
        video: '/images/video-community/video-demo-6.mp4',
        prompt: 'best quality,a cute anime girl,sunshine,soft features,swing,a blue white edged dress,solo,flower,blue eyes,blush,blue flower,long hair,barefoot,sitting,looking at viewer,blue rose,blue theme,rose,light particles,pale skin,blue background,off shoulder,full body,smile,collarbone,long hair,blue hair,vines,plants,' 
    },
    { 
        id: 7, 
        image: '/images/video-community/video-demo-7.png', 
        video: '/images/video-community/video-demo-7.mp4',
        prompt: 'The night watchman\'s clapper fades,a gas lamp hisses awake at the curb.The hunchback stirs his wrought-iron pot,herbs swirling like forgotten spells.The usual, croaks a salaryman in a loosened tie.When the broth pours, moonlight catchessomething glimmering at the bottom—half a dragon scale.' 
    },
    { 
        id: 8, 
        image: '/images/video-community/video-demo-8.png', 
        video: '/images/video-community/video-demo-8.mp4',
        prompt: "On a drizzly street, a couple embraces tightly under a transparent umbrella. The girl's hair is gently blown by the wind, while the boy pulls her close. They donu2019t kiss — just gaze into each otheru2019s eyes, as if the whole world has fallen silent." 
    },
    { 
        id: 9, 
        image: '/images/video-community/video-demo-9.png', 
        video: '/images/video-community/video-demo-9.mp4',
        prompt: 'On a spring afternoon, cherry blossom petals drift gently through the air. A girl in a sailor uniform stands beneath the sakura tree, hearing familiar footsteps behind her. She turns slightly, her eyes soft and shy, cheeks blushing — as if the whole of spring pauses in that moment.' 
    },
    { 
        id: 10, 
        image: '/images/video-community/video-demo-10.png', 
        video: '/images/video-community/video-demo-10.mp4',
        prompt: 'Anime-style scene.A cute anime girl in a white dress with long, flowing blue hair stands beneath a blooming sakura tree. Her cheeks are faintly blushed, and her eyes glisten with unshed tears. She gently tucks a fallen cherry blossom into the chest pocket of a boy wearing a dark school uniform. He has neatly combed black hair and a gentle, bittersweet expression. The sky behind them glows with sunset hues, and petals drift slowly through the air.' 
    },
    { 
        id: 11, 
        image: '/images/video-community/video-demo-11.png', 
        video: '/images/video-community/video-demo-11.mp4',
        prompt: 'Anime-style scene.Under a dazzling summer fireworks display, a silver-haired girl in a pale purple yukata nervously clutches her fan. Her head is slightly lowered, heart visibly racing. Beside her stands a boy in a deep blue male yukata, his short black hair neatly styled. He turns to look at her, fireworks reflected in his calm, expectant eyes — waiting for her to say what\'s in her heart.' 
    },
    { 
        id: 12, 
        image: '/images/video-community/video-demo-12.png', 
        video: '/images/video-community/video-demo-12.mp4',
        prompt: 'Anime-style scene, wide aerial view of a fantasy floating city at sunrise, white-stone castle with golden spires in the center, surrounded by floating islands connected by bridges and magical rails, narrow winding streets, red-tiled roofs, soft sunlight piercing through clouds, airships flying in the distance, protective energy shield glowing around the city, cinematic wide shot, reminiscent of Studio Ghibli meets Final Fantasy background art' 
    },
]

export default videoCommunityWorks

