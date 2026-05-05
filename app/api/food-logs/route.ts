import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      user_id,
      food_name,
      portion,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
      meal_type,
    } = body;

    if (!user_id || !food_name || !meal_type) {
      return NextResponse.json(
        { success: false, error: 'user_id, food_name, and meal_type are required' },
        { status: 400 }
      );
    }

    await supabase.from('users').upsert({
      id: user_id,
      name: 'Athlete',
    }, { onConflict: 'id' });

    const payload = {
      user_id,
      food_name,
      portion: portion || '1 serving',
      calories: Number(calories) || 0,
      protein_g: Number(protein_g) || 0,
      carbs_g: Number(carbs_g) || 0,
      fat_g: Number(fat_g) || 0,
      fiber_g: Number(fiber_g) || 0,
      meal_type,
      date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
    };

    let { data, error } = await supabase
      .from('food_logs')
      .insert(payload)
      .select('*')
      .single();

    if (error?.message?.includes("'portion' column")) {
      const legacyPayload: Partial<typeof payload> = { ...payload };
      delete legacyPayload.portion;
      const legacyResult = await supabase
        .from('food_logs')
        .insert(legacyPayload)
        .select('*')
        .single();
      data = legacyResult.data;
      error = legacyResult.error;
    }

    if (error?.message?.includes("'date' column")) {
      const legacyPayload: Partial<typeof payload> = { ...payload };
      delete legacyPayload.date;
      const legacyResult = await supabase
        .from('food_logs')
        .insert(legacyPayload)
        .select('*')
        .single();
      data = legacyResult.data;
      error = legacyResult.error;
    }

    if (error?.message?.includes("'created_at' column")) {
      const legacyPayload: Partial<typeof payload> = { ...payload };
      delete legacyPayload.created_at;
      const legacyResult = await supabase
        .from('food_logs')
        .insert(legacyPayload)
        .select('*')
        .single();
      data = legacyResult.data;
      error = legacyResult.error;
    }

    if (error) {
      console.error('[Food Logs API] Insert error:', error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[Food Logs API] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('food_logs').delete().eq('id', id);

    if (error) {
      console.error('[Food Logs API] Delete error:', error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Food Logs API] Fatal delete error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
