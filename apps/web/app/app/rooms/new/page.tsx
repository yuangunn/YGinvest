import { Card, CardContent } from "@/components/ui/card";
import { RoomCreateForm } from "@/components/room-create-form";

export default function NewRoomPage() {
  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">방 만들기</h1>
      <Card>
        <CardContent className="pt-6">
          <RoomCreateForm />
        </CardContent>
      </Card>
    </div>
  );
}
