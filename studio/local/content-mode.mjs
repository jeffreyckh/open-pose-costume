export function contentMode(prompt='') {
 if(prompt.includes('[ADULT_ART_STUDY]')) return 'art';
 if(prompt.includes('[ADULT_SWIMWEAR]')) return 'swimwear';
 if(prompt.includes('[ADULT_LINGERIE_FASHION]')) return 'lingerie';
 return 'standard';
}
export function modeContract(mode) {
 return mode==='art'
 ? 'Create a non-erotic fine-art life drawing of one fictional clearly mature adult aged 25 or older, with neutral expression, natural anatomy and soft studio lighting. Anatomical nudity is permitted as an academic life study; no sexual action, arousal, fetish framing or genital emphasis. Use the mannequin only for gesture and camera. Invent a new face and identity; do not depict or undress a real person. No text, collage or reference panels.'
 : mode==='swimwear'
 ? 'Non-sexual adult swimwear catalog photograph. Clearly mature adult, age25 or older. Match the referenced swimsuit cut, straps, fabric, coverage and colors, naturally fitted. Fashion presentation, neutral expression, no sexual action or erotic emphasis.'
 : mode==='lingerie'
 ? 'Non-sexual adult lingerie fashion catalog photograph. Clearly mature adult, age25 or older. Preserve the referenced underwear design, seams, lace and coverage, naturally worn. Keep intimate areas covered with opaque lining; no nudity, sexual action, arousal or erotic framing.' : '';
}
