import {
  FaceShape,
  FacialMeasurements,
  HairLengthCategory,
  HairType,
  VirtualHairstyleId,
  VirtualTryOnAnalysis,
} from '@/lib/types/domain';
import {processFaceIdData} from '@/lib/utils/face-id-processor';

export {
  deriveFaceShapeFromMeasurements,
  processFaceIdData,
  sanitizeFacialMeasurements,
  VALID_CRANIAL_SHAPES,
} from '@/lib/utils/face-id-processor';

export function computeManualVisagism(params: {
  styleId: VirtualHairstyleId;
  faceShape?: FaceShape;
  facialMeasurements?: FacialMeasurements;
  hairType?: HairType;
  hairLength?: HairLengthCategory;
}): VirtualTryOnAnalysis {
  return processFaceIdData({
    styleId: params.styleId,
    faceShape: params.faceShape,
    facialMeasurements: params.facialMeasurements,
    hairType: params.hairType,
    hairLength: params.hairLength,
  });
}
