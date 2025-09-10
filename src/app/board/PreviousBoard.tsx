export default function PreviousBoard({ officers }: { officers: PreviousOfficer[] }) {
  return (
    <div>
      {officers.map((officer) => (
        <div key={officer.id}>
          {officer.name}: {officer.role}
        </div>
      ))}
    </div>
  );
}
