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
        prompt: '银发黄瞳的动漫少女，身穿白色背心与蓝色牛仔短裤，在温馨室内环境中俏皮地左右摇摆身体，双手轻握拳举至胸前，嘴角带着甜美微笑。画面采用中景镜头，柔和暖光从侧后方打来，发丝与衣物有细腻光泽与自然褶皱，整体风格为日系动漫写实风，动态流畅自然，表情生动可爱，背景虚化突出主体，超高清细节，稳定画面，流畅运动。' 
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
        prompt: '银发少女跪坐在卧室木地板上，身穿白色短款T恤和破洞牛仔短裤，一手轻抚发丝，一手比出“V”字手势，眼神温柔注视镜头。镜头缓慢环绕拍摄，展现她自然放松的姿态与精致妆容，背景是温馨的居家环境，光线柔和，氛围宁静。超详细、流畅运动、稳定画面。' 
    },
    { 
        id: 7, 
        image: '/images/video-community/video-demo-7.png', 
        video: '/images/video-community/video-demo-7.mp4',
        prompt: '银发少女身穿白色衬衫与蓝白格子百褶裙，站在室内柔和光线下，微微侧身，双手轻提裙摆，裙摆随动作自然扬起。镜头缓慢环绕，捕捉她清澈眼神与精致妆容，背景为简约家居环境，整体画面呈现写实风格，细节丰富，动作流畅自然，超高清动态影像。' 
    },
    { 
        id: 8, 
        image: '/images/video-community/video-demo-8.png', 
        video: '/images/video-community/video-demo-8.mp4',
        prompt: "一位紫发少女在卧室中自拍，她身着精致的紫色和服式cosplay服装，头戴蝴蝶发饰，手持淡紫色iPhone手机，镜头前微微一笑。画面从静止开始，镜头缓慢推近，同时她轻轻调整姿势，手指轻抚衣襟，手机轻微晃动，营造自然真实的动态感。背景是简约的白色墙壁和灰色床铺，光线柔和均匀，整体风格写实细腻，画面流畅稳定，细节丰富，色彩饱满。" 
    },
    { 
        id: 9, 
        image: '/images/video-community/video-demo-9.png', 
        video: '/images/video-community/video-demo-9.mp4',
        prompt: '一个银发红瞳的小恶魔少女，跪坐在洒满阳光的木地板上，身后有白色小恶魔翅膀，头顶黑色小角，身后拖着一条蓬松的白色小恶魔尾巴，尾巴自然摆动，动作轻柔灵动，整体画面温暖治愈，光线柔和，充满动漫风格，超详细，流畅运动，稳定画面。' 
    },
    { 
        id: 10, 
        image: '/images/video-community/video-demo-10.png', 
        video: '/images/video-community/video-demo-10.mp4',
        prompt: '一位穿着日系校服的少女在操场自拍，微风吹动发丝，她轻抚脸颊，嘴角带着甜美微笑，眼神温柔灵动。画面采用手持自拍视角，镜头轻微晃动，营造自然随性的氛围。背景是红色跑道与绿色草坪，远处有看台和树木，光线柔和，整体风格清新治愈，充满青春活力。视频流畅自然，细节丰富，人物表情生动，动作轻柔可爱，适合青春校园题材。' 
    },
    { 
        id: 11, 
        image: '/images/video-community/video-demo-11.png', 
        video: '/images/video-community/video-demo-11.mp4',
        prompt: '雨中古风女侠，身着精致暗纹战甲与半透明长袍，腰佩长剑，湿发垂肩，单膝轻倚石阶，目光冷峻如霜。背景是飞檐斗拱的中式庭院，雨丝斜织，地面水光粼粼，灯笼微光摇曳。镜头缓慢环绕，展现她飒爽英姿与雨中孤傲之美，画面质感超细腻，动态流畅，氛围沉静而充满力量感。' 
    },
    { 
        id: 12, 
        image: '/images/video-community/video-demo-12.png', 
        video: '/images/video-community/video-demo-12.mp4',
        prompt: '一位戴眼镜的年轻女学生，身穿白色衬衫与深蓝色百褶裙，安静地倚靠在图书馆窗边书架旁阅读。窗外是秋日校园，金黄落叶飘落，阳光透过玻璃洒在她身上。她手中捧着一本打开的书，面前放着一杯热茶，袅袅热气升起。镜头缓慢推近，聚焦于她专注阅读的侧脸，书页随呼吸轻轻翻动，茶香氤氲，落叶在窗外随风轻舞。画面风格写实温柔，色调温暖柔和，光影自然，细节精致，氛围宁静致远。超详细，流畅运动，稳定画面。' 
    },
]

export default videoCommunityWorks

