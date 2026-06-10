// Curated set of major surface muscles for the stylized (code-built) model.
//
// The 3D figure is generated procedurally from primitives (see `muscleLayout.ts`),
// keyed by muscle `id`. There is no external GLB anymore. `id` is the single source
// of truth that links a data entry to its geometry in the layout map.

export interface MuscleData {
  id: string;
  nameEn: string;
  nameFa: string;
  region: string;
  description: string;
}

export const muscles: MuscleData[] = [
  {
    id: "sternocleidomastoid",
    nameEn: "Sternocleidomastoid",
    nameFa: "جناغی‌چنبری‌پستانی",
    region: "neck",
    description:
      "A paired neck muscle that flexes the neck and turns the head to the opposite side.",
  },
  {
    id: "trapezius",
    nameEn: "Trapezius",
    nameFa: "ذوزنقه‌ای",
    region: "back",
    description:
      "A large diamond-shaped muscle of the upper back and neck that moves and stabilizes the shoulder blade.",
  },
  {
    id: "deltoid",
    nameEn: "Deltoid",
    nameFa: "دلتایی",
    region: "shoulder",
    description:
      "The rounded muscle capping the shoulder that lifts the arm out to the side and assists flexion and extension.",
  },
  {
    id: "pectoralis_major",
    nameEn: "Pectoralis Major",
    nameFa: "سینه‌ای بزرگ",
    region: "chest",
    description:
      "A large fan-shaped chest muscle that pulls the arm forward and across the body.",
  },
  {
    id: "serratus_anterior",
    nameEn: "Serratus Anterior",
    nameFa: "دندانه‌ای قدامی",
    region: "chest",
    description:
      "A finger-like muscle along the side of the rib cage that holds the shoulder blade against the chest wall.",
  },
  {
    id: "rectus_abdominis",
    nameEn: "Rectus Abdominis",
    nameFa: "راست شکمی",
    region: "core",
    description:
      "The paired 'six-pack' muscle running down the abdomen that bends the trunk forward.",
  },
  {
    id: "external_oblique",
    nameEn: "External Oblique",
    nameFa: "مایل خارجی شکم",
    region: "core",
    description:
      "The outermost side abdominal muscle that rotates and side-bends the trunk.",
  },
  {
    id: "latissimus_dorsi",
    nameEn: "Latissimus Dorsi",
    nameFa: "پشتی بزرگ",
    region: "back",
    description:
      "A broad muscle of the mid and lower back that pulls the arm down and back.",
  },
  {
    id: "biceps_brachii",
    nameEn: "Biceps Brachii",
    nameFa: "دوسر بازویی",
    region: "arm",
    description:
      "The muscle on the front of the upper arm that bends the elbow and turns the palm up.",
  },
  {
    id: "triceps_brachii",
    nameEn: "Triceps Brachii",
    nameFa: "سه‌سر بازویی",
    region: "arm",
    description:
      "The muscle on the back of the upper arm that straightens the elbow.",
  },
  {
    id: "brachioradialis",
    nameEn: "Brachioradialis",
    nameFa: "بازویی‌زندزبرینی",
    region: "forearm",
    description:
      "A forearm muscle that bends the elbow, most active when the grip is in a neutral position.",
  },
  {
    id: "extensor_digitorum",
    nameEn: "Extensor Digitorum",
    nameFa: "بازکننده انگشتان",
    region: "forearm",
    description:
      "A muscle on the back of the forearm that straightens the fingers and wrist.",
  },
  {
    id: "gluteus_maximus",
    nameEn: "Gluteus Maximus",
    nameFa: "سرینی بزرگ",
    region: "hip",
    description:
      "The largest muscle of the buttock that straightens the hip and powers standing and climbing.",
  },
  {
    id: "rectus_femoris",
    nameEn: "Rectus Femoris (Quadriceps)",
    nameFa: "راست رانی (چهارسر)",
    region: "leg",
    description:
      "The central muscle on the front of the thigh that straightens the knee. Part of the quadriceps group.",
  },
  {
    id: "vastus_lateralis",
    nameEn: "Vastus Lateralis",
    nameFa: "پهن خارجی",
    region: "leg",
    description:
      "The large outer quadriceps muscle of the thigh that straightens the knee.",
  },
  {
    id: "vastus_medialis",
    nameEn: "Vastus Medialis",
    nameFa: "پهن داخلی",
    region: "leg",
    description:
      "The teardrop-shaped inner quadriceps muscle just above the knee that straightens the leg.",
  },
  {
    id: "sartorius",
    nameEn: "Sartorius",
    nameFa: "خیاطه",
    region: "leg",
    description:
      "The longest muscle in the body, crossing the thigh diagonally to bend the hip and knee.",
  },
  {
    id: "adductor_longus",
    nameEn: "Adductor Longus",
    nameFa: "نزدیک‌کننده دراز",
    region: "leg",
    description:
      "An inner-thigh muscle that pulls the leg toward the midline.",
  },
  {
    id: "biceps_femoris",
    nameEn: "Biceps Femoris (Hamstring)",
    nameFa: "دوسر رانی (همسترینگ)",
    region: "leg",
    description:
      "A hamstring muscle on the back of the thigh that bends the knee and extends the hip.",
  },
  {
    id: "gastrocnemius",
    nameEn: "Gastrocnemius",
    nameFa: "دوقلوی ساق",
    region: "leg",
    description:
      "The prominent two-headed calf muscle that points the foot down and helps bend the knee.",
  },
  {
    id: "soleus",
    nameEn: "Soleus",
    nameFa: "نعلی",
    region: "leg",
    description:
      "A flat calf muscle beneath the gastrocnemius that points the foot down, especially with the knee bent.",
  },
  {
    id: "tibialis_anterior",
    nameEn: "Tibialis Anterior",
    nameFa: "درشت‌نئی قدامی",
    region: "leg",
    description:
      "A muscle on the front of the shin that lifts the foot upward.",
  },
];
