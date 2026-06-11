-- Ideal joint-angle references for AI form scoring of the common lifts.
-- Angles are degrees; ranges are [bottom, top] of the rep.
UPDATE exercises SET form_reference = ref.data
FROM (VALUES
  ('squat', '{"knee_range":[70,170],"hip_range":[60,170],"torso_lean_max":45,"cues":["Knees track over toes","Hit at least parallel depth (~90° knee)","Neutral spine, chest up","Drive through mid-foot"]}'::jsonb),
  ('deadlift', '{"knee_range":[100,175],"hip_range":[60,175],"torso_lean_max":60,"cues":["Bar stays against the legs","Hips and shoulders rise together","Neutral spine throughout","Lock out with glutes, not lower back"]}'::jsonb),
  ('bench press', '{"elbow_range":[60,165],"cues":["Elbows ~45° from torso","Bar touches mid-chest","Feet planted, slight arch","Full lockout without bouncing"]}'::jsonb),
  ('push-up', '{"elbow_range":[70,165],"torso_lean_max":15,"cues":["Body in a straight line","Chest near the floor","Elbows ~45° from torso","Full elbow extension at top"]}'::jsonb),
  ('overhead press', '{"elbow_range":[70,170],"torso_lean_max":15,"cues":["Bar path close to the face","Glutes and core braced","Full overhead lockout","No excessive lower-back arch"]}'::jsonb),
  ('barbell row', '{"elbow_range":[60,160],"torso_lean_max":75,"cues":["Hinge to ~45° torso or lower","Pull to lower chest / upper abdomen","No torso heave","Control the eccentric"]}'::jsonb),
  ('lat pulldown', '{"elbow_range":[50,165],"cues":["Pull bar to upper chest","Elbows drive down and back","Slight backward lean only","Full stretch at the top"]}'::jsonb),
  ('biceps curl', '{"elbow_range":[40,165],"cues":["Elbows pinned to the sides","No shoulder swing","Full extension at the bottom","Squeeze at the top"]}'::jsonb),
  ('lunge', '{"knee_range":[80,170],"torso_lean_max":20,"cues":["Front knee over ankle","Back knee approaches the floor","Upright torso","Push through the front heel"]}'::jsonb),
  ('plank', '{"hip_range":[160,180],"cues":["Straight line ear-shoulder-hip-ankle","Glutes and core engaged","No sagging hips","Neutral neck"]}'::jsonb)
) AS ref(keyword, data)
WHERE exercises.name ILIKE '%' || ref.keyword || '%';
