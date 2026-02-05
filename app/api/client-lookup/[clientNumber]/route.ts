import { NextResponse } from 'next/server';
// @ts-ignore
import { getClientDetails } from '@/lib/utils';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientNumber: string }> }
) {
  const { clientNumber } = await params;
  
  try {
    const clientDetails = await getClientDetails(clientNumber);
    
    if (clientDetails && clientDetails.length > 0) {
      return NextResponse.json({
        success: true,
        data: clientDetails[0]
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      });
    }
  } catch (error: any) {
    console.error('Error looking up client:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
