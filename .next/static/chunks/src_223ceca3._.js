(globalThis.TURBOPACK = globalThis.TURBOPACK || []).push([typeof document === "object" ? document.currentScript : undefined, {

"[project]/src/data/boardMembers.ts [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname, k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "default": (()=>__TURBOPACK__default__export__)
});
const boardMembers = [
    {
        id: "aristani",
        name: "Aristani Rodriguez-Gonzalez",
        role: "President & Founder",
        major: "Criminology, Law & Society",
        whyJoined: "I created this club to offer my fellow students with accesible ways to explore Orange County. Eventually, it became a great way to foster community with all types of people since everyone is encouraged to join. I have continued to manage the club because I want to continue to explore nature and meet other amazing people while doing so!",
        favoriteMemory: "Camping in Sequoia since it was the most isolating from the outside world and I had not been there before! Love exploring new places alongside others!",
        instagram: "https://instagram.com/aristanii/"
    },
    {
        id: "alexis",
        name: "Alexis Ibarra",
        role: "General Secretary",
        major: "Cognitive Science",
        whyJoined: "In my second year I really wanted to join a community, and AAC was incredibly welcoming and full of positive energy, and I already loved hiking so it was a great match.",
        favoriteMemory: "Takin a fat nap after the chasm of doom.",
        instagram: "https://www.instagram.com/freeform.ond/"
    },
    {
        id: "lokesh",
        name: "Lokesh Sharma",
        role: "Webmaster",
        major: "Computer Science",
        whyJoined: "I was looking to make new friends my first quarter at UCI and as a freshman I found everyone in AAC super welcoming, outgoing, and of course adventurous! After a few meetings and picnics I felt like I found a solid group of friends!",
        favoriteMemory: "Walking around Las Vegas at 3AM with the club during our Fall '23 retreat!",
        instagram: "https://www.instagram.com/lakeshoreee/"
    },
    {
        id: "thomas",
        name: "Thomas Lobaton",
        role: "Fundraising Chair",
        major: "Urban Studies",
        whyJoined: "I joined the club because I needed to be outdoors more and the potluck picnics made it really easy to get to meet people while I was still commuting to school. The weekend events also made it really fun to explore SoCal and experience more than just hiking or going to the beach.",
        favoriteMemory: "The San Diego Farmers market and then going to the Birch Aquarium.",
        instagram: "https://www.instagram.com/tom_the_train67/"
    },
    {
        id: "sofia",
        name: "Sofia Barsan",
        role: "Outreach Coordinator & Club Advisor",
        major: "Language Science",
        whyJoined: "I love adventure and exploring the outdoors, and both of those are better in good company. I saw the club was going to Switzer Falls in LA and I had never seen a natural waterfall in person before, so why not? Everyone in the club was incredibly welcoming and accommodating, so I stayed, even joined the board, and its been countless adventures ever since",
        favoriteMemory: "Literally running around, racing each other, on the Death Valley salt flats in Badwater Basin.",
        instagram: "https://www.instagram.com/bealiberty/"
    },
    {
        id: "daron",
        name: "Daron Kaloustian",
        role: "Treasurer",
        major: "Business Economics",
        whyJoined: "I like nature so much and have grown to like it even more with the club.",
        favoriteMemory: "Random outings to yum restaurants and outings to the beach.",
        instagram: "https://www.instagram.com/daron_kal/"
    },
    {
        id: "charlie",
        name: "Charlie Weinberger",
        role: "General Officer & Co-Webmaster",
        major: "Computer Science",
        whyJoined: "I joined the club to meet new people outside of my major and participate in fun outdoor events that get me to leave campus and explore the world!",
        favoriteMemory: "Going hiking and exploring sand dunes in the desert with friends at our 2025 winter quarter Death Valley retreat!",
        instagram: "https://www.instagram.com/charliebrown364/"
    },
    {
        id: "ryan",
        name: "Ryan Fenstermacher",
        role: "General Officer",
        major: "Psychological Science",
        whyJoined: "I wanted to break out of Irvine and spend more time exploring the nature and communities in Southern California!",
        favoriteMemory: "Going to Palm Springs after visiting the Salton Sea and getting stuck in a Christmas parade😭.",
        instagram: "https://www.instagram.com/rfenstermac/"
    },
    {
        id: "kristina",
        name: "Kristina Qu",
        role: "Visibility Team",
        major: "Biological Sciences",
        whyJoined: "I love nature and outdoors adventures, this is a great place to do it and meet people who share the same passion.",
        favoriteMemory: "Slept under the stars in Joshua Tree and saw the Milky Way for the first time in my life.",
        instagram: "https://www.instagram.com/qu.kristina/"
    },
    {
        id: "jason",
        name: "Jason Zenarosa",
        role: "Vice President",
        major: "Computer Science",
        whyJoined: "",
        favoriteMemory: "",
        instagram: "https://www.instagram.com/jsnznrs/?__d=1%2F"
    }
];
const __TURBOPACK__default__export__ = boardMembers;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/src/app/board/page.tsx [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname, k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "default": (()=>Board)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/image.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$data$2f$boardMembers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/data/boardMembers.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
const PolaroidCard = ({ member, openPopup })=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "polaroid",
        onClick: ()=>openPopup(member.id),
        "data-popup-style": `${member.id}-style`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                src: `/images/board/${member.id}.jpg`,
                alt: member.name,
                width: 300,
                height: 300
            }, void 0, false, {
                fileName: "[project]/src/app/board/page.tsx",
                lineNumber: 21,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "caption",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "name-font",
                        children: member.name
                    }, void 0, false, {
                        fileName: "[project]/src/app/board/page.tsx",
                        lineNumber: 28,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                        fileName: "[project]/src/app/board/page.tsx",
                        lineNumber: 29,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "role-font",
                        children: member.role
                    }, void 0, false, {
                        fileName: "[project]/src/app/board/page.tsx",
                        lineNumber: 30,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/board/page.tsx",
                lineNumber: 27,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/board/page.tsx",
        lineNumber: 16,
        columnNumber: 5
    }, this);
};
_c = PolaroidCard;
const PopupDetails = ({ member, closePopup })=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        id: `popup-${member.id}`,
        className: "popup",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: `popup-content ${member.id}-style`,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "close",
                    onClick: ()=>closePopup(member.id),
                    children: "×"
                }, void 0, false, {
                    fileName: "[project]/src/app/board/page.tsx",
                    lineNumber: 46,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: `name-font ${member.id}-name`,
                    children: member.name
                }, void 0, false, {
                    fileName: "[project]/src/app/board/page.tsx",
                    lineNumber: 49,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                    fileName: "[project]/src/app/board/page.tsx",
                    lineNumber: 50,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "role-font",
                    children: member.role
                }, void 0, false, {
                    fileName: "[project]/src/app/board/page.tsx",
                    lineNumber: 51,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                    children: "Major"
                }, void 0, false, {
                    fileName: "[project]/src/app/board/page.tsx",
                    lineNumber: 52,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    children: member.major
                }, void 0, false, {
                    fileName: "[project]/src/app/board/page.tsx",
                    lineNumber: 53,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                    children: [
                        "Why I ",
                        member.id === "aristani" ? "created" : "joined",
                        " AAC"
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/board/page.tsx",
                    lineNumber: 54,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    children: member.whyJoined
                }, void 0, false, {
                    fileName: "[project]/src/app/board/page.tsx",
                    lineNumber: 55,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                    children: "My favorite AAC Memory..."
                }, void 0, false, {
                    fileName: "[project]/src/app/board/page.tsx",
                    lineNumber: 56,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    children: member.favoriteMemory
                }, void 0, false, {
                    fileName: "[project]/src/app/board/page.tsx",
                    lineNumber: 57,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "instagram-link",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        href: member.instagram,
                        target: "_blank",
                        rel: "noopener",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            src: "/logos/instagram.svg",
                            alt: "Instagram",
                            width: 55,
                            height: 40,
                            className: "instagram-icon"
                        }, void 0, false, {
                            fileName: "[project]/src/app/board/page.tsx",
                            lineNumber: 60,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/board/page.tsx",
                        lineNumber: 59,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/app/board/page.tsx",
                    lineNumber: 58,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/app/board/page.tsx",
            lineNumber: 45,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/board/page.tsx",
        lineNumber: 44,
        columnNumber: 5
    }, this);
};
_c1 = PopupDetails;
function Board() {
    _s();
    const [activePopup, setActivePopup] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const openPopup = (id)=>{
        setActivePopup(id);
        // Add any additional styling needed for the popup to appear
        document.getElementById(`popup-${id}`)?.classList.add("active");
    };
    const closePopup = (id)=>{
        setActivePopup(null);
        // Remove the active class when closing
        document.getElementById(`popup-${id}`)?.classList.remove("active");
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "meet_the_board-main",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                children: "Meet the Board!"
            }, void 0, false, {
                fileName: "[project]/src/app/board/page.tsx",
                lineNumber: 91,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h6", {
                children: "Click to learn more about each officer!"
            }, void 0, false, {
                fileName: "[project]/src/app/board/page.tsx",
                lineNumber: 92,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "polaroid-gallery",
                children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$data$2f$boardMembers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].map((member)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PolaroidCard, {
                        member: member,
                        openPopup: openPopup
                    }, member.id, false, {
                        fileName: "[project]/src/app/board/page.tsx",
                        lineNumber: 96,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/app/board/page.tsx",
                lineNumber: 94,
                columnNumber: 7
            }, this),
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$data$2f$boardMembers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].map((member)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PopupDetails, {
                    member: member,
                    closePopup: closePopup
                }, member.id, false, {
                    fileName: "[project]/src/app/board/page.tsx",
                    lineNumber: 101,
                    columnNumber: 9
                }, this)),
            activePopup && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "popup-overlay",
                onClick: ()=>closePopup(activePopup)
            }, void 0, false, {
                fileName: "[project]/src/app/board/page.tsx",
                lineNumber: 105,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/board/page.tsx",
        lineNumber: 90,
        columnNumber: 5
    }, this);
}
_s(Board, "ghC/8TFhigOHLapolvbd6VdqWLE=");
_c2 = Board;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "PolaroidCard");
__turbopack_context__.k.register(_c1, "PopupDetails");
__turbopack_context__.k.register(_c2, "Board");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
}]);

//# sourceMappingURL=src_223ceca3._.js.map