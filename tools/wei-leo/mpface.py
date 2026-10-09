# Pontos do rosto (MediaPipe Face Landmarker, Apache 2.0) — só na preparação das texturas.
import os
import paths
import numpy as np, cv2
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

_det = None


def detector():
    global _det
    if _det is None:
        opts = vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=os.path.join(paths.MPMODEL, 'face_landmarker.task')), num_faces=1)
        _det = vision.FaceLandmarker.create_from_options(opts)
    return _det


def landmarks(img, name=None):
    h, w = img.shape[:2]
    r = detector().detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(img)))
    if not r.face_landmarks:
        return None
    L = np.array([[p.x * w, p.y * h, p.z * w] for p in r.face_landmarks[0]])
    if name:
        from PIL import Image
        vis = img.copy()
        for x, y, z in L:
            cv2.circle(vis, (int(round(x)), int(round(y))), 1, (0, 255, 0), -1)
        Image.fromarray(vis).save(f'{paths.SHOTS}/mp-{name}.png')
    return L


_pose = None


def pose_landmarks(img, name=None):
    """33 pontos do corpo (MediaPipe Pose Landmarker)."""
    global _pose
    if _pose is None:
        opts = vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=os.path.join(paths.MPMODEL, 'pose_landmarker_heavy.task')), num_poses=1)
        _pose = vision.PoseLandmarker.create_from_options(opts)
    h, w = img.shape[:2]
    r = _pose.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(img)))
    if not r.pose_landmarks:
        return None
    L = np.array([[p.x * w, p.y * h, p.visibility] for p in r.pose_landmarks[0]])
    if name:
        from PIL import Image
        vis = img.copy()
        for k, (x, y, v) in enumerate(L):
            cv2.circle(vis, (int(round(x)), int(round(y))), 3, (0, 255, 0) if v > 0.5 else (255, 0, 0), -1)
            cv2.putText(vis, str(k), (int(x) + 3, int(y) - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (255, 255, 0), 1)
        Image.fromarray(vis).save(f'{paths.SHOTS}/mpp-{name}.png')
    return L
