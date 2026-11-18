import {contentMode,modeContract} from './content-mode.mjs';
export const MODELS={diffusion:'flux-2-klein-base-4b-fp8.safetensors',text:'qwen_3_4b.safetensors',vae:'full_encoder_small_decoder.safetensors'};
export function buildWorkflow({images,prompt,size='768x1024',quality='auto',seed=17351,poseTitle='',poseAngle='front'}){
 const mode=contentMode(prompt),art=mode==='art';
 if(art)images={pose:images.pose};
 if(!images.pose||(!art&&!images.costume))throw Error('Choose a pose and a garment in the reference board. A face reference is optional.');
 const sizes={'768x1024':[768,1024],'1024x1024':[1024,1024],'1024x768':[1024,768]};if(!Object.hasOwn(sizes,size))throw Error('Unsupported local resolution');
 const steps={auto:20,low:12,medium:20,high:28}[quality];if(!steps)throw Error('Invalid quality');const[width,height]=sizes[size];
 let id=0;const graph={};const add=(class_type,inputs)=>{const key=String(++id);graph[key]={class_type,inputs};return(slot=0)=>[key,slot];};
 const model=add('UNETLoader',{unet_name:MODELS.diffusion,weight_dtype:'default'});
 const clip=add('CLIPLoader',{clip_name:MODELS.text,type:'flux2',device:'cpu'});
 const vae=add('VAELoader',{vae_name:MODELS.vae});
 const roles=['pose',...(!art?['costume']:[]),...(images.character?['character']:[])];
 const asymmetric=/neck and thigh/i.test(poseTitle+' '+prompt) && poseAngle==='front'
  ? 'For this front-view neck-and-thigh pose: the hand on the LEFT of the picture touches the side of the neck, with that elbow pointing outward. The RIGHT arm hangs down and its hand is beside the thigh. Do not put both hands at the collar. Preserve the head tilt, hip tilt and stance shown in image 1.' : '';
 const appearance=images.character?'Preserve the adult reference face apparent age, exact expression, eye openness, skin complexion and undertone. Do not substitute a broad toothy smile for a closed-mouth reference. Match the portrait exposure and white balance under soft diffuse neutral lighting; avoid an invented tan, golden cast or harsh cheek shadows. Respect explicitly requested lighting or artistic style.':'';
 const instruction=`Create ONE coherent, natural photograph of an adult person wearing the referenced outfit, physically fitted and draped on their body in the referenced pose. Image 1 is ONLY the pose/composition reference: interpret its joints and gesture; remove all sketch lines, mannequin circles and construction marks. Image 2 is ONLY the garment reference: preserve its neckline, sleeves, color, fabric, pattern, cut and accessories; reconstruct how it is worn in this pose with natural seams, folds, contact and shadows. ${images.character?'Image 3 is ONLY the identity reference: preserve the face shape, eyes, nose, mouth, smile and hairstyle of that adult person.':''} Do not paste a flat garment or copy the reference backgrounds. No collage, reference panels, text or watermark. Natural anatomy and photographic skin. Follow the requested artistic style if explicitly specified. Pose details: ${asymmetric} Appearance details: ${appearance} Additional user instructions: ${prompt}`;
 const finalInstruction=art?`${modeContract(mode)} Additional artistic instructions: ${prompt}`:instruction+'\n'+modeContract(mode);
 let positive=add('CLIPTextEncode',{clip:clip(),text:finalInstruction})();
 let negative=add('CLIPTextEncode',{clip:clip(),text:''})();
 for(const role of roles){const image=add('LoadImage',{image:images[role]});const scaled=add('ImageScaleToTotalPixels',{image:image(),upscale_method:'lanczos',megapixels:.5,resolution_steps:16});const latent=add('VAEEncode',{pixels:scaled(),vae:vae()});positive=add('ReferenceLatent',{conditioning:positive,latent:latent()})();negative=add('ReferenceLatent',{conditioning:negative,latent:latent()})();}
 const latent=add('EmptyFlux2LatentImage',{width,height,batch_size:1});const guider=add('CFGGuider',{model:model(),positive,negative,cfg:5});const noise=add('RandomNoise',{noise_seed:seed});const sampler=add('KSamplerSelect',{sampler_name:'euler'});const sigmas=add('Flux2Scheduler',{steps,width,height});
 const sampled=add('SamplerCustomAdvanced',{noise:noise(),guider:guider(),sampler:sampler(),sigmas:sigmas(),latent_image:latent()});const decoded=add('VAEDecode',{samples:sampled(),vae:vae()});const saved=add('SaveImage',{images:decoded(),filename_prefix:'LocalReferenceStudioV2'});
 return{graph,outputNode:saved()[0],instruction:finalInstruction,contentMode:mode};
}
