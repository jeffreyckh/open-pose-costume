"""Single-face identity refinement; pretrained InsightFace weights are research-only."""
from pathlib import Path
import sys,json,importlib.util
from types import SimpleNamespace
import numpy as np
import cv2
import onnxruntime as ort
from PIL import Image,ImageOps
ROOT=Path(__file__).resolve().parent
VENDOR=ROOT/'face-identity'
sys.path.insert(0,str(VENDOR))
from face_align import norm_crop, norm_crop2
from inswapper import INSwapper
from insightface.model_zoo.scrfd import SCRFD
from insightface.model_zoo.arcface_onnx import ArcFaceONNX

def session(path):
 options=ort.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1
 return ort.InferenceSession(str(path),sess_options=options,providers=['CPUExecutionProvider'])
def load(path):return cv2.cvtColor(np.array(ImageOps.exif_transpose(Image.open(path)).convert('RGB')),cv2.COLOR_RGB2BGR)
def main():
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('source');parser.add_argument('target');parser.add_argument('output');parser.add_argument('--method',choices=['swap','pixels'],default='swap');parser.add_argument('--boost',type=int,choices=[1,2],default=2);args=parser.parse_args()
 out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 det=SCRFD(model_file=str(VENDOR/'det_10g.onnx'),session=session(VENDOR/'det_10g.onnx'));det.prepare(-1,input_size=(640,640))
 rec=ArcFaceONNX(model_file=str(VENDOR/'w600k_r50.onnx'),session=session(VENDOR/'w600k_r50.onnx'))
 def face(image,label):
  boxes,points=det.detect(image,input_size=(640,640),threshold=.6)
  if len(boxes)!=1:raise ValueError(f'{label}: expected exactly one clear face; detected {len(boxes)}')
  embedding=rec.get_feat(norm_crop(image,landmark=points[0],image_size=112)).ravel();embedding=embedding/np.linalg.norm(embedding)
  return SimpleNamespace(bbox=boxes[0,:4],kps=points[0],normed_embedding=embedding)
 source=load(args.source);target=load(args.target);sf=face(source,'Reference');tf=face(target,'Generated image')
 if min(tf.bbox[2:]-tf.bbox[:2])<55:raise ValueError('Generated face is too small for reliable refinement. Use a closer composition or larger output.')
 if args.method=='pixels':
  def yaw(f):return float((f.kps[2,0]-f.kps[:2,0].mean())/np.linalg.norm(f.kps[1]-f.kps[0]))
  if abs(yaw(sf)-yaw(tf))>.2:raise ValueError('Reference-pixel transfer requires similar near-frontal head views')
  aligned,sm=norm_crop2(source,sf.kps,image_size=512)
  _,tm=norm_crop2(target,tf.kps,image_size=512)
  alpha=np.zeros((512,512),np.float32);cv2.ellipse(alpha,(256,278),(153,188),0,0,360,1,-1);alpha=cv2.GaussianBlur(alpha,(31,31),0)
  inverse=cv2.invertAffineTransform(tm);mapped=cv2.warpAffine(aligned,inverse,(target.shape[1],target.shape[0]));matte=cv2.warpAffine(alpha,inverse,(target.shape[1],target.shape[0]))[:,:,None]
  candidate=np.clip(mapped*matte+target*(1-matte),0,255).astype(np.uint8)
 else:
  swapper=INSwapper(str(VENDOR/'inswapper_128.onnx'),session=session(VENDOR/'inswapper_128.onnx'))
  candidate=swapper.get(target,tf,sf,paste_back=True,pixel_boost=args.boost)
 # Hard support limit: no pixels may change outside an expanded detected face box.
 x1,y1,x2,y2=tf.bbox;pad=.12*max(x2-x1,y2-y1);h,w=target.shape[:2];box=(max(0,int(x1-pad)),max(0,int(y1-pad)),min(w,int(x2+pad)+1),min(h,int(y2+pad)+1))
 support=np.zeros((h,w),dtype=bool);support[box[1]:box[3],box[0]:box[2]]=True
 candidate[~support]=target[~support]
 after=face(candidate,'Refined image');before_score=float(np.dot(sf.normed_embedding,tf.normed_embedding));after_score=float(np.dot(sf.normed_embedding,after.normed_embedding))
 if after_score<=before_score+.03:raise ValueError(f'Identity diagnostic did not improve sufficiently ({before_score:.3f} -> {after_score:.3f}); candidate retained only for review, not returned')
 cv2.imwrite(str(out/'identity-result.png'),candidate)
 audit={'method':('Aligned reference facial pixels' if args.method=='pixels' else 'InsightFace inswapper_128; CPU only'),'pixel_boost':args.boost,'reference_faces':1,'target_faces':1,'recognition_cosine_before':before_score,'recognition_cosine_after':after_score,'metric_note':'Same recognition family as swapper conditioning; diagnostic only, not independent likeness proof','allowed_face_box':box,'pixels_changed_outside_face_box':int(np.any(candidate!=target,axis=2)[~support].sum()),'license':'Non-commercial research only','quality_approved':False}
 (out/'identity-audit.json').write_text(json.dumps(audit,indent=2));print(json.dumps(audit),flush=True)
 # Review board: normalized face crops, explicitly labeled reference / before / after.
 from PIL import ImageDraw
 board=Image.new('RGB',(768,300),'white');draw=ImageDraw.Draw(board)
 for i,(name,image,f)in enumerate([('REFERENCE',source,sf),('BEFORE',target,tf),('AFTER',candidate,after)]):
  x,y,r,b=f.bbox.astype(int);pad=int(.18*max(r-x,b-y));crop=image[max(0,y-pad):min(image.shape[0],b+pad),max(0,x-pad):min(image.shape[1],r+pad)];tile=Image.fromarray(cv2.cvtColor(crop,cv2.COLOR_BGR2RGB));tile.thumbnail((250,260));board.paste(tile,(i*256+(256-tile.width)//2,30));draw.text((i*256+12,8),name,fill='black')
 board.save(out/'identity-comparison.png')
if __name__=='__main__':main()
